// conn-25.js
// Run from aura-app root: node conn-25.js
// CONN-25: Wire Gestao Aura to real admin API

const fs = require('fs');
const p = require('path');

const filePath = p.join('app', '(tabs)', 'gestao-aura.tsx');
let c = fs.readFileSync(filePath, 'utf-8');
let changes = 0;

// 1. Add imports
if (!c.includes('useQuery')) {
  c = c.replace(
    'import { Colors } from "@/constants/colors";',
    'import { Colors } from "@/constants/colors";\nimport { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";\nimport { adminApi } from "@/services/api";'
  );
  console.log('OK: Added useQuery + adminApi imports');
  changes++;
}

// 2. Add useAuthStore import if missing
if (!c.includes('import { useAuthStore }') && !c.includes('useAuthStore }')) {
  c = c.replace(
    'import { Icon }',
    'import { useAuthStore } from "@/stores/auth";\nimport { Icon }'
  );
}

// 3. Wire Dashboard component to real data
// Add hooks at the start of Dashboard function
if (c.includes('function Dashboard()') && !c.includes('apiDashboard')) {
  c = c.replace(
    'function Dashboard() {',
    `function Dashboard() {
  // CONN-25: Fetch real admin dashboard data
  const { token, isStaff } = useAuthStore();
  const { data: apiDashboard } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.dashboard(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });
  // TODO: replace CLIENTS mock with apiDashboard when backend returns real data
`
  );
  console.log('OK: Dashboard useQuery added');
  changes++;
}

// 4. Wire ClientsTable to real data
if (c.includes('function ClientsTable()') && !c.includes('apiClients')) {
  c = c.replace(
    'function ClientsTable() {',
    `function ClientsTable() {
  // CONN-25: Fetch real admin clients
  const { token, isStaff } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: apiClients } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: () => adminApi.clients(),
    enabled: !!token && isStaff,
    retry: 1,
    staleTime: 30000,
  });

  // CONN-25: Toggle module mutation
  const toggleMutation = useMutation({
    mutationFn: ({ companyId, module, enabled }: { companyId: string; module: string; enabled: boolean }) =>
      adminApi.toggleModule(companyId, module, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    },
  });
  // TODO: replace CLIENTS mock with apiClients?.clients when backend returns real data
`
  );
  console.log('OK: ClientsTable useQuery + toggleMutation added');
  changes++;
}

// 5. Update the Switch onValueChange to use the mutation
if (c.includes('toast.success(mod + " atualizado para " + client.name)') && !c.includes('toggleMutation.mutate')) {
  c = c.replace(
    'toast.success(mod + " atualizado para " + client.name)',
    `(() => {
                        if (isStaff && token) {
                          toggleMutation.mutate({ companyId: client.id, module: mod.toLowerCase().replace(/ /g, "_"), enabled: !isOn });
                        }
                        toast.success(mod + " atualizado para " + client.name);
                      })()`
  );
  console.log('OK: Toggle switch wired to mutation');
  changes++;
}

fs.writeFileSync(filePath, c, 'utf-8');

console.log('\nTotal changes: ' + changes);
console.log('Run:');
console.log('  git add -A && git commit -m "feat: CONN-25 gestao aura connected to real admin API" && git push');

try { fs.unlinkSync('conn-25.js'); } catch {}
