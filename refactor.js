const fs = require('fs');

const targetFile = "src/app/cashier/page.tsx";
let content = fs.readFileSync(targetFile, 'utf8');

const replacementBlock = `                          {(order.items as OrderItem[]).map((item, index) => (
                            <li key={\`\${order.id}-\${item.product_id}-\${index}\`} className="group rounded-2xl bg-slate-50 px-3 py-3 hover:bg-slate-100 transition">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 break-words">
                                  <span className="font-semibold text-slate-900">
                                    {item.quantity}x {item.name}
                                  </span>
                                  {item.modifiers?.length ? (
                                    <div className="mt-1 text-xs text-slate-500">
                                      {item.modifiers.map((modifier) => \`\${modifier.group_name}: \${modifier.option_name}\`).join(" / ")}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                  <span className="font-numeric pt-1">{Number(item.line_total).toFixed(2)} TL</span>
                                  <form action={cancelOrderItemAction}>
                                    <input type="hidden" name="orderId" value={order.id} />
                                    <input type="hidden" name="returnOrderId" value={order.id} />
                                    <input type="hidden" name="productId" value={item.product_id} />
                                    <button
                                      type="submit"
                                      title="Urunu dus veya iptal et"
                                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-500 opacity-20 transition hover:bg-rose-50 hover:border-rose-200 group-hover:opacity-100 focus:opacity-100"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                                      </svg>
                                    </button>
                                  </form>
                                </div>
                              </div>
                            </li>
                          ))}`;

const regex = /\{\(order\.items as OrderItem\[\]\)\.map\(\(item, index\) => \([\s\S]*?<\/li>\s*\)\)\}/m;

if (regex.test(content)) {
    content = content.replace(regex, replacementBlock);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log("Success");
} else {
    console.log("Regex not found");
}
