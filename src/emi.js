// EMI engine. Uses the same flat-rate interest model as the original frontend:
// interest = loan * (APR/100) * (months/12), repaid in equal monthly installments.
const DEFAULT_TENURES = [3, 6, 9, 12];

const round2 = (n) => Math.round(n * 100) / 100;

function calcEmi(merchant, months, userDownPayment = 0) {
  const down = Math.max(userDownPayment, merchant.minDown);
  const loan = Math.max(0, merchant.price - down);
  const interest = loan * (merchant.apr / 100) * (months / 12);
  const totalLoanToRepay = loan + interest;
  const monthlyEmi = months > 0 ? totalLoanToRepay / months : 0;
  const totalOutlay = down + totalLoanToRepay + merchant.fee;
  return {
    platform: merchant.name,
    tenureMonths: months,
    apr: merchant.apr,
    noCostEmi: merchant.apr === 0,
    downPayment: round2(down),
    loanAmount: round2(loan),
    interestAmount: round2(interest),
    monthlyInstallment: round2(monthlyEmi),
    processingFee: merchant.fee,
    totalOutlay: round2(totalOutlay)
  };
}

function buildEmiTable(product, userDownPayment = 0, tenures = DEFAULT_TENURES) {
  const rows = [];
  for (const m of product.merchants) {
    for (const months of tenures) rows.push(calcEmi(m, months, userDownPayment));
  }
  const best = rows.reduce((a, b) => (b.totalOutlay < a.totalOutlay ? b : a), rows[0]);
  return { productId: product.id, userDownPayment, rows, bestPlan: best };
}

module.exports = { calcEmi, buildEmiTable, DEFAULT_TENURES };
