// 检查 INSERT 列和 VALUES 数组是否匹配

const columns = [
  'id', 'email', 'password',
  'access_token', 'csrf_token', 'refresh_token', 'x_amz_sso_authn', 'client_id', 'client_secret', 'region', 'expires_at', 'auth_method', 'provider',
  'subscription_type', 'subscription_title', 'subscription_raw_type', 'subscription_expires_at', 'subscription_days_remaining',
  'upgrade_capability', 'overage_capability', 'management_target',
  'usage_current', 'usage_limit', 'usage_percent_used', 'usage_last_updated',
  'base_limit', 'base_current', 'free_trial_limit', 'free_trial_current', 'free_trial_expiry',
  'usage_bonuses', 'next_reset_date',
  'resource_type', 'resource_display_name', 'resource_display_name_plural', 'resource_currency', 'resource_unit',
  'overage_rate', 'overage_cap', 'overage_enabled',
  'nickname', 'idp', 'user_id', 'visitor_id', 'group_id', 'tags',
  'status', 'last_error', 'consecutive_failures', 'is_active', 'device_id', 'assigned_at',
  'created_at', 'last_used_at', 'last_checked_at', 'owner_user_id'
]

const values = [
  'id', 'email', 'password',
  'access_token', 'csrf_token', 'refresh_token', 'x_amz_sso_authn', 'client_id', 'client_secret', 'region', 'expires_at', 'auth_method', 'provider',
  'subscription_type', 'subscription_title', 'subscription_raw_type', 'subscription_expires_at', 'subscription_days_remaining',
  'upgrade_capability', 'overage_capability', 'management_target',
  'usage_current', 'usage_limit', 'usage_percent_used', 'usage_last_updated',
  'base_limit', 'base_current', 'free_trial_limit', 'free_trial_current', 'free_trial_expiry',
  'usage_bonuses', 'next_reset_date',
  'resource_type', 'resource_display_name', 'resource_display_name_plural', 'resource_currency', 'resource_unit',
  'overage_rate', 'overage_cap', 'overage_enabled',
  'nickname', 'idp', 'user_id', 'visitor_id', 'group_id', 'tags',
  'status', 'last_error', 'consecutive_failures', 'is_active', 'device_id', 'assigned_at',
  'created_at', 'last_used_at', 'last_checked_at', 'owner_user_id'
]

console.log('Columns count:', columns.length)
console.log('Values count:', values.length)
console.log('Match:', columns.length === values.length)

if (columns.length !== values.length) {
  console.log('\nMissing in values:')
  columns.forEach((col, i) => {
    if (values[i] !== col) {
      console.log(`  Position ${i}: expected '${col}', got '${values[i] || 'MISSING'}'`)
    }
  })
}
