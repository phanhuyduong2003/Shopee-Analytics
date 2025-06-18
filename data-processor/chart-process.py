import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import time
import numpy as np

cred = credentials.Certificate("./firebase-config.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def fetch_data():
    print("Đang lấy dữ liệu từ Firestore...")
    docs = db.collection("events").stream()
    df = pd.DataFrame([doc.to_dict() for doc in docs])
    print(f"Số dòng sau khi đọc từ Firestore: {len(df)}")
    # Loại bỏ cột trùng tên nếu có
    df = df.loc[:, ~df.columns.duplicated()]
    return df

def process_all_charts(df):
    print("Đang xử lý các biểu đồ...")
    print(f"Số dòng ban đầu: {len(df)}")
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df = df.dropna(subset=['category', 'action', 'source', 'timestamp', 'userId'])
    print(f"Số dòng sau dropna: {len(df)}")
    # Bỏ lọc theo thời gian 7 ngày
    # df = df[df['timestamp'] >= pd.Timestamp.now(tz='UTC') - pd.Timedelta(days=7)]
    print(f"Số dòng sau lọc theo thời gian 7 ngày (đã bỏ lọc): {len(df)}")
    # Loại bỏ cột trùng tên nếu có (phòng trường hợp dữ liệu đầu vào vẫn lỗi)
    df = df.loc[:, ~df.columns.duplicated()]
    charts = {}
    df['day'] = df['timestamp'].dt.floor('d')
    df['hour'] = df['timestamp'].dt.hour
    df['weekday'] = df['timestamp'].dt.dayofweek

    # 1. Phân tích hành vi người dùng
    charts['action_counts'] = (
        df['action'].value_counts().reset_index(name='count').rename(columns={'index': 'action'})
        .to_dict(orient='records')
    )
    charts['hourly_action_counts'] = (
        df.groupby(['hour', 'action']).size().reset_index(name='count')
        .to_dict(orient='records')
    )
    charts['daily_action_counts'] = (
        df.groupby(['day', 'action']).size().reset_index(name='count')
        .to_dict(orient='records')
    )
    charts['source_action_counts'] = (
        df.groupby(['source', 'action']).size().reset_index(name='count')
        .to_dict(orient='records')
    )
    user_source = df.groupby('userId')['source'].first().value_counts(normalize=True).mul(100).round(2)
    charts['user_source_percentage'] = [
        {'source': k, 'percentage': v} for k, v in user_source.items()
    ]

    # 2. Phân tích tỉ lệ chuyển đổi
    action_pivot = df.pivot_table(index='userId', columns='action', aggfunc='size', fill_value=0)
    total_view = (action_pivot['view'] > 0).sum() if 'view' in action_pivot else 0
    total_cart = (action_pivot['add_to_cart'] > 0).sum() if 'add_to_cart' in action_pivot else 0
    total_buy = (action_pivot['purchase'] > 0).sum() if 'purchase' in action_pivot else 0
    charts['conversion_funnel'] = {
        'view': total_view,
        'add_to_cart': total_cart,
        'purchase': total_buy
    }
    charts['conversion_rate'] = {
        'view_to_cart': round(total_cart / total_view * 100, 2) if total_view else 0,
        'cart_to_purchase': round(total_buy / total_cart * 100, 2) if total_cart else 0,
        'view_to_purchase': round(total_buy / total_view * 100, 2) if total_view else 0
    }
    # Conversion by source
    conv_by_source = []
    for src, group in df.groupby('source'):
        pivot = group.pivot_table(index='userId', columns='action', aggfunc='size', fill_value=0)
        # User đã view
        view_users = set(pivot.index[pivot.get('view', 0) > 0]) if 'view' in pivot else set()
        # User đã add_to_cart và đã view
        cart_users = set(pivot.index[(pivot.get('add_to_cart', 0) > 0) & (pivot.get('view', 0) > 0)]) if 'add_to_cart' in pivot and 'view' in pivot else set()
        # User đã purchase và đã add_to_cart và đã view
        purchase_users = set(pivot.index[(pivot.get('purchase', 0) > 0) & (pivot.get('add_to_cart', 0) > 0) & (pivot.get('view', 0) > 0)]) if 'purchase' in pivot and 'add_to_cart' in pivot and 'view' in pivot else set()

        v = len(view_users)
        c = len(cart_users)
        b = len(purchase_users)
        conv_by_source.append({
            'source': src,
            'view': v,
            'add_to_cart': c,
            'purchase': b,
            'view_to_cart': round(c / v * 100, 2) if v else 0,
            'cart_to_purchase': round(b / c * 100, 2) if c else 0,
            'view_to_purchase': round(b / v * 100, 2) if v else 0
        })
    charts['conversion_by_source'] = conv_by_source

    # 3. Phân tích theo sản phẩm
    charts['top_products_by_action'] = {}
    for act in ['view', 'add_to_cart', 'purchase']:
        top = (
            df[df['action'] == act]['productName']
            .value_counts().head(10).reset_index(name='count').rename(columns={'index': 'productName'})
            .to_dict(orient='records')
        )
        charts['top_products_by_action'][act] = top
    # Stacked bar: số lượt view, add_to_cart, purchase theo category
    charts['category_action_distribution'] = (
        df.groupby(['category', 'action']).size().reset_index(name='count')
        .to_dict(orient='records')
    )

    # 4. Phân tích theo nguồn truy cập
    # Đã có source_action_counts, conversion_by_source, user_source_percentage

    # 5. Phân tích theo thời gian
    charts['weekly_action_counts'] = (
        df.groupby([df['timestamp'].dt.isocalendar().week, 'action']).size().reset_index(name='count')
        .rename(columns={'week': 'week'})
        .to_dict(orient='records')
    )
    # Peak purchase times
    peak_purchase = (
        df[df['action'] == 'purchase'].groupby(['hour']).size().reset_index(name='count')
        .sort_values('count', ascending=False).head(3)
        .to_dict(orient='records')
    )
    charts['peak_purchase_times'] = peak_purchase
    # Heatmap: hoạt động theo giờ-trong-ngày
    charts['heatmap_hour_day'] = (
        df.groupby(['weekday', 'hour']).size().reset_index(name='count')
        .to_dict(orient='records')
    )

    # 6. Phân tích người dùng
    charts['top_users_by_activity'] = (
        df['userId'].value_counts().head(10).reset_index(name='count').rename(columns={'index': 'userId'})
        .to_dict(orient='records')
    )
    charts['top_users_by_purchase'] = (
        df[df['action'] == 'purchase']['userId'].value_counts().head(10).reset_index(name='count').rename(columns={'index': 'userId'})
        .to_dict(orient='records')
    )
    # Phân loại người dùng
    behavior_map = df.groupby('userId')['action'].unique()
    categories = {'only_view': 0, 'view_and_cart': 0, 'only_buy': 0, 'full_flow': 0}
    for acts in behavior_map.values:
        acts = set(acts)
        if acts == {'view'}:
            categories['only_view'] += 1
        elif acts == {'view', 'add_to_cart'}:
            categories['view_and_cart'] += 1
        elif acts == {'purchase'}:
            categories['only_buy'] += 1
        elif 'view' in acts and 'purchase' in acts:
            categories['full_flow'] += 1
    charts['user_behavior_types'] = categories

    return charts

def convert_numpy(obj):
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy(i) for i in obj]
    return obj

def save_to_firestore(charts):
    print("Đang lưu dữ liệu phân tích lên Firestore...")
    doc_ref = db.collection("chart_data").document("latest")
    doc_ref.set(charts)
    print("Đã lưu dữ liệu phân tích vào Firestore collection 'chart_data'")

if __name__ == "__main__":
    while True:
        try:
            df = fetch_data()
            charts = process_all_charts(df)
            charts = convert_numpy(charts)
            save_to_firestore(charts)
        except Exception as e:
            print(f"Lỗi xử lý dữ liệu: {e}")
        time.sleep(300)
