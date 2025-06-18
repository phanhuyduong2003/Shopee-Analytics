import firebase_admin
from firebase_admin import credentials, firestore
import pandas as pd
import os
import time

cred = credentials.Certificate("./firebase-config.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def firestore_has_data():
    print("Kiểm tra xem Firestore có dữ liệu hay không...")
    docs = db.collection("events").limit(1).stream()
    return any(True for _ in docs)

def push_csv_to_firestore(file_path):
    print("Đang đẩy dữ liệu lên Firebase Firestore...")
    try:
        if not os.path.exists(file_path):
            print(f"File {file_path} không tồn tại.")
            return
        print(f"Đang đẩy dữ liệu từ {file_path} lên Firebase Firestore...")
        df = pd.read_csv(file_path)
        df = df.dropna(subset=["userId", "productId", "productName", "category", "action", "source", "timestamp"])
        for _, row in df.iterrows():
            db.collection("events").add(row.to_dict())
        print("Đã đẩy dữ liệu lên Firebase Firestore")
    except Exception as e:
        print(f"Lỗi khi đẩy dữ liệu: {e}")

def generate_csv():
    os.system("python /data-generator/generate.py")

if __name__ == "__main__":
    if not firestore_has_data():
        print("Firestore chưa có dữ liệu, tạo file CSV và đẩy lần đầu")
        generate_csv()
        push_csv_to_firestore("/data/user_events.csv")
    else:
        print("Firestore đã có dữ liệu. Bắt đầu đẩy 5 phút/lần")
    while True:
        time.sleep(300)
        push_csv_to_firestore("/data/user_events.csv")
        generate_csv()
