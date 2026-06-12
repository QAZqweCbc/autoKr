-- 添加 client_secret 字段到 accounts 表
-- 如果字段已存在，此语句会被忽略

ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS client_secret TEXT COMMENT 'OAuth客户端密钥';

-- 验证字段是否添加成功
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'accounts' 
AND COLUMN_NAME IN ('client_id', 'client_secret', 'refresh_token', 'region');
