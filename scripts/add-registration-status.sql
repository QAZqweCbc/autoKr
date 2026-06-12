-- 添加注册状态追踪字段
-- 用于防止注册过程中被误删除

ALTER TABLE client_users
ADD COLUMN registration_status ENUM('pending', 'in_progress', 'completed') DEFAULT 'cpleted' COMMENT '注册状态: pending=待开始, in_progress=进行中, completed=已完成';

ALTER TABLE client_users
ADD COLUMN pending_delete BOOLEAN DEFAULT FALSE COMMENT '预删除标记: TRUE=等待删除';

ALTER TABLE client_users
ADD COLUMN registration_started_at BIGINT NULL COMMENT '注册开始时间';

ALTER TABLE client_users
ADD INDEX idx_pending_delete (pending_delete);

-- 将现有用户标记为已完成注册
UPDATE client_users SET registration_status = 'completed' WHERE registration_status IS NULL;
