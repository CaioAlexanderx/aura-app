// P1 #1: Wire DiscountSection into CartPanel + pdv.tsx
// Run: cd ~/aura-app && node scripts/wire-discount.js
const fs = require('fs');
const path = require('path');

// 1. Update CartPanel.tsx — add import + section + props
const cartPanelPath = path.join(__dirname, '..', 'components', 'screens', 'pdv', 'CartPanel.tsx');
let cp = fs.readFileSync(cartPanelPath, 'utf8');

// Add import
if (!cp.includes('DiscountSection')) {
  cp = cp.replace(
    'import type { CartItem } from "@/hooks/useCart";',
    'import type { CartItem } from "@/hooks/useCart";\nimport { DiscountSection } from "./DiscountSection";'
  );

  // Add props to CartPanel function signature (before couponCode)
  cp = cp.replace(
    'couponCode?: string;',
    'discountType?: "%" | "R$";\n  setDiscountType?: (t: "%" | "R$") => void;\n  discountValue?: string;\n  setDiscountValue?: (v: string) => void;\n  manualDiscountAmount?: number;\n  clearDiscount?: () => void;\n  couponCode?: string;'
  );

  // Add destructured props (before couponCode in the function params)
  cp = cp.replace(
    'couponCode, setCouponCode,',
    'discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,\n    couponCode, setCouponCode,'
  );

  // Add DiscountSection before the total divider
  // Find the last divider before total
  const totalDividerPattern = '<View style={s.divider} />\n\n          {/* Total */}';
  if (cp.includes(totalDividerPattern)) {
    cp = cp.replace(
      totalDividerPattern,
      `{/* P1 #1: Manual discount */}
          {setDiscountType && setDiscountValue && (
            <View style={{ marginTop: 4 }}>
              <DiscountSection
                total={total}
                discountType={discountType || "%"}
                setDiscountType={setDiscountType}
                discountValue={discountValue || ""}
                setDiscountValue={setDiscountValue}
                manualDiscountAmount={manualDiscountAmount || 0}
                clearDiscount={clearDiscount || (() => {})}
              />
            </View>
          )}

          <View style={s.divider} />

          {/* Total */}`
    );
  } else {
    // Alternative pattern
    cp = cp.replace(
      /{\/* Total \*\/}/,
      `{/* P1 #1: Manual discount */}
          {setDiscountType && setDiscountValue && (
            <DiscountSection total={total} discountType={discountType || "%"} setDiscountType={setDiscountType} discountValue={discountValue || ""} setDiscountValue={setDiscountValue} manualDiscountAmount={manualDiscountAmount || 0} clearDiscount={clearDiscount || (() => {})} />
          )}

          {/* Total */}`
    );
  }

  fs.writeFileSync(cartPanelPath, cp, 'utf8');
  console.log('  CartPanel.tsx updated with DiscountSection');
} else {
  console.log('  CartPanel.tsx already has DiscountSection');
}

// 2. Update pdv.tsx — pass discount props to CartPanel
const pdvPath = path.join(__dirname, '..', 'app', '(tabs)', 'pdv.tsx');
let pdv = fs.readFileSync(pdvPath, 'utf8');

if (!pdv.includes('discountType')) {
  // Add discount props to cartPanelProps object
  pdv = pdv.replace(
    'couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,',
    'discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,\n    couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,'
  );

  // Add to useCart destructuring
  pdv = pdv.replace(
    'couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,\n  } = useCart();',
    'couponCode, setCouponCode, couponApplied, setCouponApplied, clearCoupon,\n    discountType, setDiscountType, discountValue, setDiscountValue, manualDiscountAmount, clearDiscount,\n  } = useCart();'
  );

  fs.writeFileSync(pdvPath, pdv, 'utf8');
  console.log('  pdv.tsx updated with discount props');
} else {
  console.log('  pdv.tsx already has discount props');
}

console.log('\nDone! Run: git add . && git commit -m "feat P1 #1: wire DiscountSection into CartPanel + pdv.tsx" && git push');
