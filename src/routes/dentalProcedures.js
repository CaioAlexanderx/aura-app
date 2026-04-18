// ============================================================
// AURA. — Dental Procedures CRUD (extracted from dental.js)
// GET /procedures, POST /procedures, PATCH /procedures/:procId
// ============================================================
const router = require('express').Router({ mergeParams: true });
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/procedures', requireAuth, async (req, res) => {
  const { category } = req.query;
  try {
    const params = [req.params.id];
    let where = 'WHERE company_id=$1 AND active=true';
    if (category) { params.push(category); where += ` AND category=$2::dental_category`; }
    const { rows } = await db.query(
      `SELECT id, code_internal, category, name, description, price_private, price_plan, active
       FROM dental_procedures ${where} ORDER BY category, name`, params
    );
    res.json({ total: rows.length, procedures: rows });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar procedimentos' }); }
});

router.post('/procedures', requireAuth, requireRole('client','analyst','admin'), async (req, res) => {
  const { code_internal, code_tuss, category, name, description, price_private, price_plan } = req.body;
  if (!code_internal || !name || price_private === undefined)
    return res.status(400).json({ error: 'code_internal, name e price_private sao obrigatorios' });
  try {
    const { rows } = await db.query(
      `INSERT INTO dental_procedures
         (company_id, code_internal, code_tuss, category, name, description, price_private, price_plan)
       VALUES ($1,$2,$3,$4::dental_category,$5,$6,$7,$8) RETURNING *`,
      [req.params.id, code_internal, code_tuss||null, category||'outros',
       name, description||null, price_private, price_plan||null]
    );
    res.status(201).json({ procedure: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Codigo interno ja existe' });
    res.status(500).json({ error: 'Erro ao cadastrar procedimento' });
  }
});

router.patch('/procedures/:procId', requireAuth, requireRole('client','analyst','admin'), async (req, res) => {
  const allowed = ['code_internal','code_tuss','category','name','description','price_private','price_plan','active'];
  const fields=[], values=[];
  let idx=1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const cast = key === 'category' ? '::dental_category' : '';
      fields.push(`${key}=$${idx++}${cast}`);
      values.push(req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  fields.push(`updated_at=NOW()`);
  values.push(req.params.procId, req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE dental_procedures SET ${fields.join(',')} WHERE id=$${idx++} AND company_id=$${idx} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ error: 'Procedimento nao encontrado' });
    res.json({ procedure: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar procedimento' }); }
});

module.exports = router;
