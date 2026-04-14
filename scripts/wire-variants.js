// Wire VariantsSection into estoque.tsx (after AddProductForm when editing)
// Run: cd ~/aura-app && node scripts/wire-variants.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(tabs)', 'estoque.tsx');
let code = fs.readFileSync(filePath, 'utf8');

if (code.includes('VariantsSection')) {
  console.log('estoque.tsx already has VariantsSection');
  process.exit(0);
}

// 1. Add imports
code = code.replace(
  "import { AddProductForm } from '@/components/screens/estoque/AddProductForm';",
  "import { AddProductForm } from '@/components/screens/estoque/AddProductForm';\nimport { VariantsSection } from '@/components/VariantsSection';"
).replace(
  'import { AddProductForm } from "@/components/screens/estoque/AddProductForm";',
  'import { AddProductForm } from "@/components/screens/estoque/AddProductForm";\nimport { VariantsSection } from "@/components/VariantsSection";'
);

// 2. Add useQuery import if not present
if (!code.includes('useQuery')) {
  code = code.replace(
    'import { useQueryClient } from "@tanstack/react-query";',
    'import { useQuery, useQueryClient } from "@tanstack/react-query";'
  );
}

// 3. Add companiesApi import if not there
if (!code.includes('companiesApi')) {
  code = code.replace(
    'import { useAuthStore } from "@/stores/auth";',
    'import { useAuthStore } from "@/stores/auth";\nimport { companiesApi } from "@/services/api";'
  );
}

// 4. Add variants query hook after scrollRef
const variantsHook = `
  // P0 #11: variants for editing product
  const editingProductId = editProduct?.id || null;
  const { data: variantsData, refetch: refetchVariants } = useQuery({
    queryKey: ['variants', company?.id, editingProductId],
    queryFn: () => companiesApi.variants(company!.id, editingProductId!),
    enabled: !!company?.id && !!editingProductId && showAddForm,
    staleTime: 30000,
  });
`;
code = code.replace(
  'const scrollRef = useRef<any>(null);',
  'const scrollRef = useRef<any>(null);' + variantsHook
);

// 5. Insert VariantsSection after AddProductForm
const variantsBlock = `

      {/* P0 #11: Variants \u2014 only when editing existing product */}
      {showAddForm && editProduct?.id && (
        <VariantsSection
          productId={editProduct.id}
          productName={editProduct.name || ''}
          basePrice={editProduct.price || 0}
          variants={variantsData?.variants || []}
          onUpdate={() => refetchVariants()}
        />
      )}`;

const addFormPattern = /editProduct={editProduct}\s*\n\s*\/>/;
if (addFormPattern.test(code)) {
  code = code.replace(addFormPattern, (match) => match + variantsBlock);
} else {
  code = code.replace(
    '{isLoading && <ListSkeleton',
    variantsBlock + '\n\n      {isLoading && <ListSkeleton'
  );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('estoque.tsx: VariantsSection wired after AddProductForm (editing only)');
console.log('\nDone! Run: git add . && git commit -m "feat P0 #11: wire VariantsSection into estoque" && git push');
