import {useMemo, useState} from 'react';
import {
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    Boxes,
    CircleDollarSign,
    Download,
    Lightbulb,
    Package,
    ReceiptText,
    Scale,
    ShoppingBag,
    TrendingUp,
} from 'lucide-react';
import {useStore} from '../store-context.js';
import {downloadCsv} from '../utils/downloadCsv.js';
import {currency, getStockStatus, number} from '../data.js';
import {BarChart, CardHeader, DonutChart, PageHeader, ProgressBar, StatCard, StatusBadge} from '../components/UI.jsx';
import ProductImage, {ProductCell} from '../components/ProductImage.jsx';
import PeriodFilter from '../components/PeriodFilter.jsx';
import {buildPeriodBuckets, createPeriodState, getPeriodRange, isDateInPeriod} from '../utils/periods.js';

/**
 * Sale items store their historical selling price. This local data store uses the
 * current product cost to estimate COGS because it does not yet have cost layers.
 * @param {import('../types.js').Sale} sale
 * @param {import('../types.js').Product[]} products
 */
const saleCost = (sale, products) => sale.items.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return sum + item.qty * Number(product?.cost || 0);
}, 0);

export default function Reports() {
    const {products, categories, sales, notify, session} = useStore();
    const [period, setPeriod] = useState(() => createPeriodState('weekly'));
    const [tab, setTab] = useState(session.role === 'Inventory Staff' ? 'inventory' : 'sales');
    const periodRange = getPeriodRange(period);

    const completedSales = useMemo(() => sales.filter((sale) => sale.status === 'Completed' && isDateInPeriod(sale.createdAt, period)), [sales, period]);
    const revenue = completedSales.reduce((sum, sale) => sum + sale.total, 0);
    const cogs = completedSales.reduce((sum, sale) => sum + saleCost(sale, products), 0);
    const grossProfit = revenue - cogs;
    const profitMargin = revenue ? (grossProfit / revenue) * 100 : 0;
    const unitsSold = completedSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.qty, 0), 0);

    const chartData = useMemo(() => buildPeriodBuckets(period, sales).map((bucket) => {
        const matching = completedSales.filter((sale) => new Date(sale.createdAt) >= bucket.start && new Date(sale.createdAt) < bucket.end);
        const value = matching.reduce((sum, sale) => sum + sale.total, 0);
        const cost = matching.reduce((sum, sale) => sum + saleCost(sale, products), 0);
        return {label: bucket.label, value, cost, profit: value - cost, orders: matching.length};
    }), [completedSales, period, products, sales]);

    const productPerformance = useMemo(() => {
        /** @type {Record<string, import('../types.js').SaleItem & { units: number, revenue: number, cost: number, profit: number }>} */
        const map = {};
        completedSales.forEach((sale) => sale.items.forEach((item) => {
            if (!map[item.productId]) map[item.productId] = {...item, units: 0, revenue: 0, cost: 0, profit: 0};
            const product = products.find((entry) => entry.id === item.productId);
            map[item.productId].units += item.qty;
            map[item.productId].revenue += item.qty * item.price;
            map[item.productId].cost += item.qty * Number(product?.cost || 0);
            map[item.productId].profit = map[item.productId].revenue - map[item.productId].cost;
        }));
        return Object.values(map).sort((a, b) => b.revenue - a.revenue);
    }, [completedSales, products]);

    const profitPerformance = useMemo(() => [...productPerformance].sort((a, b) => b.profit - a.profit), [productPerformance]);
    const categoryColors = ['#6574e8', '#2f9d8f', '#e5a43a', '#de6c75', '#3d9bc2'];
    const categorySales = categories.map((category, index) => ({
        label: category.name,
        color: category.color || categoryColors[index % categoryColors.length],
        value: productPerformance.filter((item) => products.find((product) => product.id === item.productId)?.categoryId === category.id).reduce((sum, item) => sum + item.revenue, 0),
    })).filter((item) => item.value > 0);

    const inventoryValue = products.reduce((sum, product) => sum + product.stock * product.cost, 0);
    const retailValue = products.reduce((sum, product) => sum + product.stock * product.price, 0);
    const bestDay = [...chartData].sort((a, b) => b.value - a.value)[0];
    const topProduct = products.find((product) => product.id === productPerformance[0]?.productId);

    const exportReport = () => {
        if (tab === 'sales') {
            downloadCsv('retailtrack-sales-analytics.csv', [
                ['RetailTrack Sales Analytics'], ['Period', periodRange.label], [],
                ['Total Revenue (LKR)', revenue], ['Completed Orders', completedSales.length], ['Units Sold', unitsSold], [],
                ['Rank', 'SKU', 'Product', 'Units Sold', 'Revenue (LKR)'],
                ...productPerformance.map((item, index) => [index + 1, item.sku, item.name, item.units, item.revenue]),
            ]);
        } else if (tab === 'profit') {
            downloadCsv('retailtrack-profit-loss.csv', [
                ['RetailTrack Profit & Loss Report'], ['Period', periodRange.label], [],
                ['Total Revenue (LKR)', revenue], ['Cost of Goods Sold (LKR)', cogs], ['Gross Profit / Loss (LKR)', grossProfit], ['Gross Margin (%)', profitMargin.toFixed(2)], [],
                ['SKU', 'Product', 'Units Sold', 'Revenue (LKR)', 'COGS (LKR)', 'Gross Profit / Loss (LKR)', 'Margin (%)'],
                ...profitPerformance.map((item) => [item.sku, item.name, item.units, item.revenue, item.cost, item.profit, item.revenue ? ((item.profit / item.revenue) * 100).toFixed(2) : '0.00']), [],
                ['Note', 'COGS uses current product costs. Operating expenses and historical cost layers are not included.'],
            ]);
        } else {
            downloadCsv('retailtrack-inventory-report.csv', [
                ['RetailTrack Inventory Report'], ['Generated', new Date().toLocaleString('en-LK')], [],
                ['Total Cost Value (LKR)', inventoryValue], ['Potential Retail Value (LKR)', retailValue], [],
                ['SKU', 'Product', 'Category', 'Stock', 'Cost Value', 'Retail Value', 'Status'],
                ...products.map((product) => [product.sku, product.name, categories.find((category) => category.id === product.categoryId)?.name, product.stock, product.stock * product.cost, product.stock * product.price, getStockStatus(product)]),
            ]);
        }
        notify(`${tab === 'sales' ? 'Sales analytics' : tab === 'profit' ? 'Profit & Loss report' : 'Inventory report'} generated as CSV.`);
    };

    return (
        <div>
            <PageHeader
                title="Reports & Analytics"
                description={session.role === 'Administrator' ? 'Generate sales, inventory and profit/loss reports from your current business records.' : 'Generate a current inventory valuation and stock-status report.'}
                actions={<>{tab !== 'inventory' &&
                    <PeriodFilter value={period} onChange={setPeriod} label="Report period"/>}
                    <button className="button button-primary" onClick={exportReport}><Download size={16}/>Generate CSV
                    </button>
                </>}
            />
            <div className="tabs-bar report-tabs">
                {session.role === 'Administrator' &&
                    <button className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}><BarChart3
                        size={17}/>Sales Analytics</button>}
                <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}><Boxes
                    size={17}/>Inventory Report
                </button>
                {session.role === 'Administrator' &&
                    <button className={tab === 'profit' ? 'active' : ''} onClick={() => setTab('profit')}><Scale
                        size={17}/>Profit / Loss</button>}
            </div>

            {tab === 'sales' && <>
                <section className="stats-grid compact-stats report-stats">
                    <StatCard icon={CircleDollarSign} label="Total Revenue" value={currency(revenue)}
                              note={periodRange.label} tone="green" trend="up"/>
                    <StatCard icon={ReceiptText} label="Completed Orders" value={completedSales.length}
                              note={`${currency(completedSales.length ? revenue / completedSales.length : 0)} average sale`}
                              tone="blue"/>
                    <StatCard icon={ShoppingBag} label="Units Sold" value={number(unitsSold)}
                              note={`${productPerformance.length} unique products`} tone="indigo"/>
                    <StatCard icon={() => <ProductImage product={topProduct} size="tiny"/>} label="Top Product"
                              value={productPerformance[0]?.name || '-'}
                              note={productPerformance[0] ? `${productPerformance[0].units} units sold` : 'No sales in this period'}
                              tone="amber"/>
                </section>
                <section className="report-chart-grid">
                    <div className="card"><CardHeader title="Revenue & Order Movement"
                                                      subtitle={`Completed sales · ${periodRange.label}`}
                                                      action={<span className="chart-legend"><i
                                                          style={{background: '#4b7bec'}}/>Revenue</span>}/><BarChart
                        data={chartData}/></div>
                    <div className="card"><CardHeader title="Sales by Category"
                                                      subtitle="Revenue contribution by catalog group"/><DonutChart
                        data={categorySales.length ? categorySales : [{label: 'No sales', value: 1, color: '#dfe5ee'}]}
                        centerLabel="ORDERS" centerValue={completedSales.length}/></div>
                </section>
                <div className="insight-banner"><span><Lightbulb size={22}/></span>
                    <div><strong>Business insight</strong><p>{bestDay?.value > 0 ? <><b>{bestDay.label}</b> generated
                        the highest revenue in this period
                        at <b>{currency(bestDay.value)}</b> across {bestDay.orders} orders.</> : 'Complete a sale to start generating revenue insights for this period.'}</p>
                    </div>
                    <span className="insight-tag"><TrendingUp size={15}/>Sales trend</span></div>
                <section className="card table-card">
                    <CardHeader title="Product Performance"
                                subtitle="Your highest-revenue products for the selected period"/>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Units Sold</th>
                                <th>Revenue</th>
                                <th>Revenue Share</th>
                                <th>Movement</th>
                            </tr>
                            </thead>
                            <tbody>
                            {productPerformance.slice(0, 8).map((item, index) => {
                                const product = products.find((entry) => entry.id === item.productId);
                                const category = categories.find((entry) => entry.id === product?.categoryId);
                                const share = revenue ? (item.revenue / revenue) * 100 : 0;
                                return <tr key={item.productId}>
                                    <td data-label="Rank"><span
                                        className={`rank-badge rank-${index + 1}`}>{index + 1}</span></td>
                                    <td data-label="Product" data-wide="true"><ProductCell product={product}
                                                                                           name={item.name}
                                                                                           sku={item.sku}/></td>
                                    <td data-label="Category" className="muted">{category?.name || '-'}</td>
                                    <td data-label="Units Sold"><strong>{item.units}</strong></td>
                                    <td data-label="Revenue"><strong>{currency(item.revenue)}</strong></td>
                                    <td data-label="Revenue Share">
                                        <div className="share-cell"><ProgressBar
                                            value={share}/><span>{share.toFixed(1)}%</span></div>
                                    </td>
                                    <td data-label="Movement"><span
                                        className={index < 3 ? 'movement-up' : 'movement-neutral'}>{index < 3 ?
                                        <ArrowUpRight size={15}/> :
                                        <ArrowDownRight size={15}/>}{index < 3 ? 'Fast moving' : 'Steady'}</span></td>
                                </tr>;
                            })}
                            {!productPerformance.length && <tr>
                                <td colSpan={7}>
                                    <div className="table-empty-message">No completed sales in the selected period.
                                    </div>
                                </td>
                            </tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </>}

            {tab === 'inventory' && <>
                <section className="stats-grid compact-stats report-stats">
                    <StatCard icon={CircleDollarSign} label="Cost Value" value={currency(inventoryValue)}
                              note="Capital currently in stock" tone="green"/>
                    <StatCard icon={TrendingUp} label="Potential Retail Value" value={currency(retailValue)}
                              note={`${currency(retailValue - inventoryValue)} potential margin`} tone="blue"/>
                    <StatCard icon={Package} label="Active Products"
                              value={products.filter((product) => product.active).length}
                              note={`${number(products.reduce((sum, product) => sum + product.stock, 0))} units on hand`}
                              tone="indigo"/>
                    <StatCard icon={Boxes} label="Stock Alerts"
                              value={products.filter((product) => product.active && ['low', 'out'].includes(getStockStatus(product))).length}
                              note="Low or out of stock" tone="amber"/>
                </section>
                <section className="card table-card">
                    <CardHeader title="Inventory Valuation"
                                subtitle="Current cost and potential retail value for every catalog item"/>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Available</th>
                                <th>Cost Price</th>
                                <th>Cost Value</th>
                                <th>Retail Value</th>
                                <th>Potential Margin</th>
                                <th>Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {[...products].sort((a, b) => b.stock * b.cost - a.stock * a.cost).map((product) => <tr
                                key={product.id}>
                                <td data-label="Product" data-wide="true"><ProductCell product={product}/></td>
                                <td data-label="Category"
                                    className="muted">{categories.find((category) => category.id === product.categoryId)?.name}</td>
                                <td data-label="Available"><strong>{product.stock}</strong></td>
                                <td data-label="Cost Price">{currency(product.cost)}</td>
                                <td data-label="Cost Value"><strong>{currency(product.stock * product.cost)}</strong>
                                </td>
                                <td data-label="Retail Value">{currency(product.stock * product.price)}</td>
                                <td data-label="Potential Margin"
                                    className="text-positive">{currency(product.stock * (product.price - product.cost))}</td>
                                <td data-label="Status"><StatusBadge status={getStockStatus(product)}/></td>
                            </tr>)}
                            </tbody>
                        </table>
                    </div>
                </section>
            </>}

            {tab === 'profit' && session.role === 'Administrator' && <>
                <section className="stats-grid compact-stats report-stats">
                    <StatCard icon={CircleDollarSign} label="Sales Revenue" value={currency(revenue)}
                              note={`${completedSales.length} completed orders`} tone="blue"/>
                    <StatCard icon={ShoppingBag} label="Cost of Goods Sold" value={currency(cogs)}
                              note={`${number(unitsSold)} units at current cost`} tone="amber"/>
                    <StatCard icon={Scale} label="Gross Profit / Loss" value={currency(grossProfit)}
                              note={grossProfit >= 0 ? 'Positive gross result' : 'Costs exceed sales revenue'}
                              tone={grossProfit >= 0 ? 'green' : 'red'} trend={grossProfit >= 0 ? 'up' : 'down'}/>
                    <StatCard icon={TrendingUp} label="Gross Margin" value={`${profitMargin.toFixed(1)}%`}
                              note="Before operating expenses" tone="indigo"/>
                </section>
                <section className="report-chart-grid">
                    <div className="card"><CardHeader title="Profit / Loss Movement"
                                                      subtitle={`Estimated gross result · ${periodRange.label}`}
                                                      action={<span className="chart-legend"><i
                                                          style={{background: grossProfit >= 0 ? '#2f9d8f' : '#de6c75'}}/>Gross result</span>}/><BarChart
                        data={chartData.map((item) => ({label: item.label, value: item.profit, orders: item.orders}))}
                        color={grossProfit >= 0 ? '#2f9d8f' : '#de6c75'}/></div>
                    <div className="card profit-summary-card"><CardHeader title="Profit & Loss Summary"
                                                                          subtitle="How sales revenue becomes gross result"/>
                        <div className="profit-breakdown">
                            <div><span>Sales revenue</span><strong>{currency(revenue)}</strong></div>
                            <div><span>Less: cost of goods sold</span><strong
                                className="text-danger">-{currency(cogs)}</strong></div>
                            <div className={`profit-result ${grossProfit >= 0 ? 'positive' : 'negative'}`}>
                                <span>Gross {grossProfit >= 0 ? 'profit' : 'loss'}</span><strong>{currency(grossProfit)}</strong>
                            </div>
                            <div className="profit-margin-bar">
                                <div><span>Gross margin</span><strong>{profitMargin.toFixed(1)}%</strong></div>
                                <ProgressBar value={Math.max(0, profitMargin)}
                                             color={grossProfit >= 0 ? '#2f9d8f' : '#de6c75'}/></div>
                            <p>Operating expenses, taxes and historical purchase-cost layers are not included. COGS is
                                estimated from current product costs.</p>
                        </div>
                    </div>
                </section>
                <section className="card table-card">
                    <CardHeader title="Product Profitability"
                                subtitle="Estimated gross profit or loss by product for the selected period"/>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Units Sold</th>
                                <th>Revenue</th>
                                <th>COGS</th>
                                <th>Gross Profit / Loss</th>
                                <th>Margin</th>
                            </tr>
                            </thead>
                            <tbody>
                            {profitPerformance.map((item) => {
                                const product = products.find((entry) => entry.id === item.productId);
                                const category = categories.find((entry) => entry.id === product?.categoryId);
                                const margin = item.revenue ? (item.profit / item.revenue) * 100 : 0;
                                return <tr key={item.productId}>
                                    <td data-label="Product" data-wide="true"><ProductCell product={product}
                                                                                           name={item.name}
                                                                                           sku={item.sku}/></td>
                                    <td data-label="Category" className="muted">{category?.name || '-'}</td>
                                    <td data-label="Units Sold">{item.units}</td>
                                    <td data-label="Revenue">{currency(item.revenue)}</td>
                                    <td data-label="COGS">{currency(item.cost)}</td>
                                    <td data-label="Gross Profit / Loss"><strong
                                        className={item.profit >= 0 ? 'text-positive' : 'text-danger'}>{currency(item.profit)}</strong>
                                    </td>
                                    <td data-label="Margin">{margin.toFixed(1)}%</td>
                                </tr>;
                            })}
                            {!profitPerformance.length && <tr>
                                <td colSpan={7}>
                                    <div className="table-empty-message">No completed sales in the selected period.
                                    </div>
                                </td>
                            </tr>}
                            </tbody>
                        </table>
                    </div>
                </section>
            </>}
        </div>
    );
}