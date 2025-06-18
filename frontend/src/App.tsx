import { useEffect, useState } from "react";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import db from "./firebase";
import {
	BarChart,
	Bar,
	CartesianGrid,
	Tooltip,
	XAxis,
	YAxis,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	Legend,
	LineChart,
	Line,
	FunnelChart,
	Funnel,
	LabelList,
} from "recharts";
import "./App.css";

const COLORS = [
	"#8884d8",
	"#82ca9d",
	"#ffc658",
	"#d88484",
	"#7fc97f",
	"#beaed4",
	"#ffbb28",
	"#ff8042",
	"#8dd1e1",
	"#a4de6c",
];

function ChartBlock({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="chart-block">
			<h2>{title}</h2>
			{children}
		</div>
	);
}

function PieBlock({ data, dataKey, nameKey }: { data: DocumentData[]; dataKey: string; nameKey: string }) {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<PieChart>
				<Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%" outerRadius={100} label>
					{data.map((_, i: number) => (
						<Cell key={i} fill={COLORS[i % COLORS.length]} />
					))}
				</Pie>
				<Tooltip />
				<Legend />
			</PieChart>
		</ResponsiveContainer>
	);
}

function LineBlock({
	data,
	xKey,
	yKey,
	color,
	xTickFormatter,
	xAngle,
}: {
	data: DocumentData[];
	xKey: string;
	yKey: string;
	color: string;
	xTickFormatter?: (v: any) => string;
	xAngle?: number;
}) {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<LineChart data={data} margin={{ top: 20, right: 30, bottom: 10 }}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey={xKey} tickFormatter={xTickFormatter} angle={xAngle} textAnchor="end" height={60} />
				<YAxis />
				<Tooltip />
				<Line type="monotone" dataKey={yKey} stroke={color} />
			</LineChart>
		</ResponsiveContainer>
	);
}

function HorizontalBarBlock({ data, xKey, yKey }: { data: DocumentData[]; xKey: string; yKey: string }) {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis type="number" dataKey={yKey} />
				<YAxis type="category" dataKey={xKey} width={220} interval={0} angle={0} textAnchor="end" />
				<Tooltip />
				<Bar dataKey={yKey} fill="#8884d8" />
			</BarChart>
		</ResponsiveContainer>
	);
}

function StackedBarBlock({ data, xKey, stackKeys }: { data: DocumentData[]; xKey: string; stackKeys: string[] }) {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey={xKey} />
				<YAxis />
				<Tooltip />
				<Legend />
				{stackKeys.map((key, i) => (
					<Bar key={key} dataKey={key} stackId="a" fill={COLORS[i % COLORS.length]} />
				))}
			</BarChart>
		</ResponsiveContainer>
	);
}

function FunnelBlock({ data }: { data: { name: string; value: number }[] }) {
	return (
		<ResponsiveContainer width="100%" height={300}>
			<FunnelChart>
				<Tooltip />
				<Funnel dataKey="value" data={data} isAnimationActive>
					<LabelList dataKey="name" position="right" />
				</Funnel>
			</FunnelChart>
		</ResponsiveContainer>
	);
}

function HeatmapBlock({ data }: { data: { weekday: number; hour: number; count: number }[] }) {
	const hours = Array.from({ length: 24 }, (_, i) => i);
	const days = [0, 1, 2, 3, 4, 5, 6];
	const weekdayNames = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
	const matrix: number[][] = days.map(() => Array(24).fill(0));
	data.forEach(({ weekday, hour, count }) => {
		if (matrix[weekday] && matrix[weekday][hour] !== undefined) matrix[weekday][hour] = count;
	});
	return (
		<div style={{ overflowX: "auto" }}>
			<table className="heatmap-table">
				<thead>
					<tr>
						<th>Thứ/Giờ</th>
						{hours.map((h) => (
							<th key={h}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{days.map((d, i) => (
						<tr key={d}>
							<td>{weekdayNames[d]}</td>
							{matrix[i].map((val, j) => (
								<td
									key={j}
									style={{ background: `rgba(136,132,216,${val ? Math.min(val / 10, 1) : 0.05})` }}
								>
									{val || ""}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="section-block">
			<h1>{title}</h1>
			{children}
		</div>
	);
}

function App() {
	const [charts, setCharts] = useState<DocumentData | null>(null);
	useEffect(() => {
		const unsub = onSnapshot(doc(db, "chart_data", "latest"), (docSnap) => {
			if (docSnap.exists()) {
				setCharts(docSnap.data());
			}
		});
		return () => unsub();
	}, []);
	if (!charts) return <div className="loading">Đang tải biểu đồ...</div>;
	// Chuẩn hóa dữ liệu cho stacked bar
	const categoryStacked = Object.values(
		charts.category_action_distribution.reduce((acc: any, cur: any) => {
			if (!acc[cur.category]) acc[cur.category] = { category: cur.category };
			acc[cur.category][cur.action] = cur.count;
			return acc;
		}, {})
	);
	// Chuẩn hóa dữ liệu cho funnel
	const funnelData = [
		{ name: "View", value: charts.conversion_funnel.view },
		{ name: "Add to Cart", value: charts.conversion_funnel.add_to_cart },
		{ name: "Purchase", value: charts.conversion_funnel.purchase },
	];
	// Chuẩn hóa dữ liệu cho grouped bar (conversion_by_source)
	const conversionBySource = charts.conversion_by_source.map((item: any) => ({
		source: item.source,
		"View → Cart": item.view_to_cart,
		"Cart → Purchase": item.cart_to_purchase,
		"View → Purchase": item.view_to_purchase,
	}));
	const dailyViewData = charts.daily_action_counts
		.filter((d: any) => d.action === "view")
		.map((d: any) => ({
			...d,
			dayStr:
				d.day && typeof d.day === "object" && "seconds" in d.day
					? new Date(d.day.seconds * 1000).toISOString().slice(0, 10)
					: "",
		}));
	return (
		<div className="dashboard">
			<SectionBlock title="1. Hành vi người dùng">
				<ChartBlock title="Số lượng hành động theo từng loại">
					<BarChart data={charts.action_counts} width={500} height={300} style={{ marginInline: "auto" }}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="action" />
						<YAxis />
						<Tooltip />
						<Bar dataKey="count" fill="#8884d8" />
					</BarChart>
				</ChartBlock>
				<ChartBlock title="Tần suất hoạt động theo giờ (Line)">
					<LineBlock
						data={charts.hourly_action_counts.filter((d: any) => d.action === "view")}
						xKey="hour"
						yKey="count"
						color="#82ca9d"
					/>
				</ChartBlock>
				<ChartBlock title="Tần suất hoạt động theo ngày (Line)">
					<LineBlock
						data={dailyViewData}
						xKey="dayStr"
						yKey="count"
						color="#ffc658"
						xTickFormatter={(v) => {
							if (typeof v === "string" && v.length === 10) {
								const [year, month, day] = v.split("-");
								return `${day}/${month}`;
							}
							return v;
						}}
						xAngle={-45}
					/>
				</ChartBlock>
				{/* <ChartBlock title="Tần suất hoạt động theo nguồn truy cập (Bar)">
					<BarChart
						data={charts.source_action_counts}
						width={500}
						height={300}
						style={{ marginInline: "auto" }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="source" />
						<YAxis />
						<Tooltip />
						<Bar dataKey="count" fill="#d88484" />
					</BarChart>
				</ChartBlock> */}
				{/* <ChartBlock title="Tỉ lệ người dùng theo nguồn truy cập (Pie)">
					<PieBlock data={charts.user_source_percentage} dataKey="percentage" nameKey="source" />
				</ChartBlock> */}
			</SectionBlock>

			<SectionBlock title="2. Tỉ lệ chuyển đổi">
				{/* <ChartBlock title="Funnel chuyển đổi View → Cart → Purchase">
					<FunnelBlock data={funnelData} />
				</ChartBlock> */}
				<ChartBlock title="So sánh tỉ lệ chuyển đổi theo nguồn (Bar)">
					<BarChart data={conversionBySource} width={500} height={300} style={{ marginInline: "auto" }}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="source" />
						<YAxis unit="%" />
						<Tooltip />
						<Legend />
						<Bar dataKey="View → Cart" fill="#8884d8" />
						<Bar dataKey="Cart → Purchase" fill="#82ca9d" />
						<Bar dataKey="View → Purchase" fill="#ffc658" />
					</BarChart>
				</ChartBlock>
			</SectionBlock>

			<SectionBlock title="3. Theo sản phẩm">
				{/* <ChartBlock title="Top 10 sản phẩm được xem nhiều nhất (Horizontal Bar)">
					<HorizontalBarBlock data={charts.top_products_by_action.view} xKey="productName" yKey="count" />
				</ChartBlock>
				<ChartBlock title="Top 10 sản phẩm được mua nhiều nhất (Horizontal Bar)">
					<HorizontalBarBlock data={charts.top_products_by_action.purchase} xKey="productName" yKey="count" />
				</ChartBlock> */}
				<ChartBlock title="Stacked Bar: Số lượt view, add_to_cart, purchase theo category">
					<StackedBarBlock
						data={categoryStacked}
						xKey="category"
						stackKeys={["view", "add_to_cart", "purchase"]}
					/>
				</ChartBlock>
			</SectionBlock>

			<SectionBlock title="4. Theo nguồn truy cập">
				<ChartBlock title="Tỉ lệ traffic theo source (Pie)">
					<PieBlock data={charts.user_source_percentage} dataKey="percentage" nameKey="source" />
				</ChartBlock>
				{/* <ChartBlock title="So sánh chuyển đổi theo từng source (Grouped Bar)">
					<BarChart data={conversionBySource} width={500} height={300} style={{ marginInline: "auto" }}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="source" />
						<YAxis unit="%" />
						<Tooltip />
						<Legend />
						<Bar dataKey="View → Cart" fill="#8884d8" />
						<Bar dataKey="Cart → Purchase" fill="#82ca9d" />
						<Bar dataKey="View → Purchase" fill="#ffc658" />
					</BarChart>
				</ChartBlock> */}
			</SectionBlock>

			<SectionBlock title="5. Theo thời gian">
				<ChartBlock title="Line chart: Hành động theo tuần">
					<LineBlock
						data={charts.weekly_action_counts.filter((d: any) => d.action === "view")}
						xKey="week"
						yKey="count"
						color="#beaed4"
					/>
				</ChartBlock>
				<ChartBlock title="Peak purchase times (Top 3 giờ mua nhiều nhất)">
					<BarChart
						data={charts.peak_purchase_times}
						width={500}
						height={300}
						style={{ marginInline: "auto" }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="hour" tickFormatter={(v: number) => `${v}:00`} />
						<YAxis />
						<Tooltip />
						<Bar dataKey="count" fill="#d88484" />
					</BarChart>
				</ChartBlock>
				<ChartBlock title="Heatmap: Hoạt động theo giờ-trong-ngày">
					<HeatmapBlock data={charts.heatmap_hour_day} />
				</ChartBlock>
			</SectionBlock>

			<SectionBlock title="6. Theo người dùng">
				{/* <ChartBlock title="Top người dùng hoạt động nhiều nhất (Bar)">
					<HorizontalBarBlock data={charts.top_users_by_activity} xKey="userId" yKey="count" />
				</ChartBlock>
				<ChartBlock title="Top người dùng mua hàng nhiều nhất (Bar)">
					<HorizontalBarBlock data={charts.top_users_by_purchase} xKey="userId" yKey="count" />
				</ChartBlock> */}
				<ChartBlock title="Phân loại người dùng (Pie)">
					<PieBlock
						data={Object.entries(charts.user_behavior_types).map(([k, v]) => ({ type: k, value: v }))}
						dataKey="value"
						nameKey="type"
					/>
				</ChartBlock>
			</SectionBlock>
		</div>
	);
}

export default App;
