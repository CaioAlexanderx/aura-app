// ============================================================
// AURA. — Dental Patients CRUD (extracted from dental.js)
// GET /patients, GET /patients/:pid, POST /patients, PATCH /patients/:pid
// ============================================================
const router = require('express').Router({ mergeParams: true });
const db = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listPatients } = require('../services/dental');

router.get('/patients', requireAuth, async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const patients = await listPatients(req.params.id, { search, page: parseInt(page), limit: parseInt(limit) });
    res.json({ total: patients.length, patients });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar pacientes' }); }
});

router.get('/patients/:pid', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM dental_patients WHERE id=$1 AND company_id=$2',
      [req.params.pid, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Paciente nao encontrado' });
    res.json({ patient: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar paciente' }); }
});

router.post('/patients', requireAuth, requireRole('client','analyst','admin'), async (req, res) => {
  const { full_name, birth_date, cpf, phone, email, gender,
          allergies, medical_history, medications, notes, lgpd_consent = false } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name e obrigatorio' });
  if (!lgpd_consent) return res.status(400).json({ error: 'Consentimento LGPD Art.11 e obrigatorio para dados de saude' });
  try {
    const { rows } = await db.query(
      `INSERT INTO dental_patients
         (company_id, full_name, birth_date, cpf, phone, email, gender,
          allergies, medical_history, medications, notes, lgpd_consent, lgpd_consent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *`,
      [req.params.id, full_name, birth_date||null, cpf||null, phone||null,
       email||null, gender||null, allergies||null, medical_history||null,
       medications||null, notes||null, true]
    );
    res.status(201).json({ patient: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Erro ao cadastrar paciente' }); }
});

router.patch('/patients/:pid', requireAuth, requireRole('client','analyst','admin'), async (req, res) => {
  const allowed = ['full_name','birth_date','cpf','phone','email','gender',
                   'allergies','medical_history','medications','notes',
                   'insurance_name','insurance_card','insurance_plan','insurance_exp'];
  const fields=[], values=[];
  let idx=1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) { fields.push(`${key}=$${idx++}`); values.push(req.body[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  fields.push(`updated_at=NOW()`);
  values.push(req.params.pid, req.params.id);
  try {
    const { rows } = await db.query(
      `UPDATE dental_patients SET ${fields.join(',')} WHERE id=$${idx++} AND company_id=$${idx} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ error: 'Paciente nao encontrado' });
    res.json({ patient: rows[0] });
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar paciente' }); }
});

module.exports = router;
