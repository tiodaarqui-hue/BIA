-- BIA - RLS Policies
-- Execute no Supabase SQL Editor

-- =====================
-- HABILITAR RLS
-- =====================
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- =====================
-- FUNÇÃO HELPER: Verificar se é staff autenticado
-- =====================
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM staff
    WHERE auth_user_id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- POLÍTICAS: STAFF
-- =====================
-- Staff pode ver outros staff
CREATE POLICY "Staff can view staff" ON staff
  FOR SELECT USING (is_staff());

-- Staff owner/manager pode inserir
CREATE POLICY "Staff owner/manager can insert" ON staff
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- Staff owner/manager pode atualizar
CREATE POLICY "Staff owner/manager can update" ON staff
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- Apenas owner pode deletar
CREATE POLICY "Staff owner can delete" ON staff
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: BARBERS
-- =====================
CREATE POLICY "Staff can view barbers" ON barbers
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert barbers" ON barbers
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update barbers" ON barbers
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff owner/manager can delete barbers" ON barbers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: BARBER_SCHEDULES
-- =====================
CREATE POLICY "Staff can view barber_schedules" ON barber_schedules
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert barber_schedules" ON barber_schedules
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update barber_schedules" ON barber_schedules
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff can delete barber_schedules" ON barber_schedules
  FOR DELETE USING (is_staff());

-- =====================
-- POLÍTICAS: BARBER_SERVICES
-- =====================
CREATE POLICY "Staff can view barber_services" ON barber_services
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert barber_services" ON barber_services
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can delete barber_services" ON barber_services
  FOR DELETE USING (is_staff());

-- =====================
-- POLÍTICAS: SERVICES
-- =====================
CREATE POLICY "Staff can view services" ON services
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert services" ON services
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update services" ON services
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff owner/manager can delete services" ON services
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: MEMBER_PLANS
-- =====================
CREATE POLICY "Staff can view member_plans" ON member_plans
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff owner/manager can insert member_plans" ON member_plans
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

CREATE POLICY "Staff owner/manager can update member_plans" ON member_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

CREATE POLICY "Staff owner can delete member_plans" ON member_plans
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: MEMBER_PLAN_SERVICES
-- =====================
CREATE POLICY "Staff can view member_plan_services" ON member_plan_services
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff owner/manager can insert member_plan_services" ON member_plan_services
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

CREATE POLICY "Staff owner/manager can delete member_plan_services" ON member_plan_services
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: CUSTOMERS
-- =====================
CREATE POLICY "Staff can view customers" ON customers
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert customers" ON customers
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update customers" ON customers
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff owner/manager can delete customers" ON customers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: NFC_CARDS
-- =====================
CREATE POLICY "Staff can view nfc_cards" ON nfc_cards
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert nfc_cards" ON nfc_cards
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update nfc_cards" ON nfc_cards
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff owner/manager can delete nfc_cards" ON nfc_cards
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: APPOINTMENTS
-- =====================
CREATE POLICY "Staff can view appointments" ON appointments
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert appointments" ON appointments
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update appointments" ON appointments
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff owner/manager can delete appointments" ON appointments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role IN ('owner', 'manager')
      AND is_active = true
    )
  );

-- =====================
-- POLÍTICAS: PAYMENTS
-- =====================
CREATE POLICY "Staff can view payments" ON payments
  FOR SELECT USING (is_staff());

CREATE POLICY "Staff can insert payments" ON payments
  FOR INSERT WITH CHECK (is_staff());

CREATE POLICY "Staff can update payments" ON payments
  FOR UPDATE USING (is_staff());

CREATE POLICY "Staff owner can delete payments" ON payments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff
      WHERE auth_user_id = auth.uid()
      AND role = 'owner'
      AND is_active = true
    )
  );
