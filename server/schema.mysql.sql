-- Risk Dashboard Namecheap MySQL schema
-- Import this file into the Namecheap cPanel MySQL database assigned to the Node.js API.
-- Do not create the database here on shared hosting. Create it from cPanel first.

CREATE TABLE IF NOT EXISTS risk_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  role_name ENUM('system_admin','risk_admin','viewer') NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  failed_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_risk_users_username (username),
  KEY idx_risk_users_role_active (role_name, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risk_app_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  setting_key VARCHAR(120) NOT NULL,
  setting_value LONGTEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_risk_app_settings_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risk_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  username VARCHAR(80) NULL,
  action VARCHAR(160) NOT NULL,
  details JSON NULL,
  ip_address VARCHAR(80) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_risk_audit_created_at (created_at),
  KEY idx_risk_audit_user_id (user_id),
  CONSTRAINT fk_risk_audit_user FOREIGN KEY (user_id) REFERENCES risk_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risk_dashboard_state (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  state_key VARCHAR(120) NOT NULL DEFAULT 'default',
  state_value LONGTEXT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_risk_dashboard_state_key (state_key),
  KEY idx_risk_dashboard_state_updated_by (updated_by),
  CONSTRAINT fk_risk_dashboard_state_user FOREIGN KEY (updated_by) REFERENCES risk_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risk_saved_workbooks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NULL,
  file_path VARCHAR(500) NULL,
  file_size BIGINT UNSIGNED NULL,
  workbook_type VARCHAR(80) NULL,
  metadata JSON NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_risk_saved_workbooks_created_at (created_at),
  KEY idx_risk_saved_workbooks_uploaded_by (uploaded_by),
  CONSTRAINT fk_risk_saved_workbooks_user FOREIGN KEY (uploaded_by) REFERENCES risk_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default branding/settings values used by the existing React tenant identity UI.
INSERT INTO risk_app_settings (setting_key, setting_value)
VALUES
  ('company_name', 'Risks Management'),
  ('logo_url', ''),
  ('cover_image_url', ''),
  ('primary_color', '#073266'),
  ('secondary_color', '#0078FF'),
  ('whatsapp_number', ''),
  ('support_email', ''),
  ('description', 'Enterprise risk management dashboard identity.'),
  ('dashboard_config', '{}')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);
