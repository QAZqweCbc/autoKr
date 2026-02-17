"""
Kiro Token 管理系统 - Python API客户端

这是一个即用型的Python API客户端，可以直接复制到你的项目中使用

使用方法:
1. 安装依赖: pip install requests
2. 复制此文件到你的项目
3. 导入并使用: from kiro_auth_client import KiroAuthClient

示例:
    client = KiroAuthClient('http://localhost:2233')
    client.send_verification_code('user@example.com')
    client.register('username', 'user@example.com', 'password', '123456')
"""

import requests
import json
from typing import Optional, Dict, Any, List


class KiroAuthError(Exception):
    """Kiro API错误"""
    def __init__(self, message: str, code: Optional[int] = None, status_code: Optional[int] = None):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class KiroAuthClient:
    """Kiro认证服务客户端"""
    
    def __init__(self, base_url: str = 'http://localhost:2233'):
        """
        初始化客户端
        
        Args:
            base_url: API基础URL，默认为 http://localhost:2233
        """
        self.base_url = base_url.rstrip('/')
        self.token: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def set_token(self, token: str):
        """设置JWT Token"""
        self.token = token
        self.session.headers.update({'Authorization': f'Bearer {token}'})
    
    def clear_token(self):
        """清除JWT Token"""
        self.token = None
        if 'Authorization' in self.session.headers:
            del self.session.headers['Authorization']
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        通用请求方法
        
        Args:
            method: HTTP方法 (GET, POST, etc.)
            endpoint: API端点
            **kwargs: 传递给requests的其他参数
            
        Returns:
            API响应数据
            
        Raises:
            KiroAuthError: API请求失败
        """
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            data = response.json()
            
            # 检查业务错误
            if not response.ok or not data.get('success'):
                error_msg = data.get('message') or data.get('error', {}).get('message') or '请求失败'
                error_code = data.get('error', {}).get('code')
                raise KiroAuthError(error_msg, error_code, response.status_code)
            
            return data
            
        except requests.RequestException as e:
            raise KiroAuthError(f'网络错误: {str(e)}')
        except json.JSONDecodeError:
            raise KiroAuthError('响应格式错误')
    
    # ==================== 认证相关 ====================
    
    def send_verification_code(self, email: str) -> Dict[str, Any]:
        """
        发送验证码
        
        Args:
            email: 邮箱地址
            
        Returns:
            响应数据
        """
        return self._request('POST', '/api/auth/send-code', json={'email': email})
    
    def register(self, username: str, email: str, password: str, code: str) -> Dict[str, Any]:
        """
        用户注册
        
        Args:
            username: 用户名
            email: 邮箱地址
            password: 密码
            code: 验证码
            
        Returns:
            包含token和user的响应数据
        """
        result = self._request('POST', '/api/auth/register', json={
            'username': username,
            'email': email,
            'password': password,
            'code': code
        })
        
        # 自动保存Token
        if 'token' in result:
            self.set_token(result['token'])
        
        return result
    
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        用户登录
        
        Args:
            email: 邮箱地址
            password: 密码
            
        Returns:
            包含token和user的响应数据
        """
        result = self._request('POST', '/api/auth/login', json={
            'email': email,
            'password': password
        })
        
        # 自动保存Token
        if 'token' in result:
            self.set_token(result['token'])
        
        return result
    
    def logout(self):
        """退出登录"""
        self.clear_token()
    
    # ==================== Token管理 ====================
    
    def request_token(self) -> Dict[str, Any]:
        """
        申请Token
        
        Returns:
            包含allocation_id的响应数据
        """
        return self._request('POST', '/api/tokens/request')
    
    def get_my_requests(self) -> List[Dict[str, Any]]:
        """
        查看我的申请
        
        Returns:
            申请记录列表
        """
        result = self._request('GET', '/api/tokens/my-requests')
        return result.get('requests', [])
    
    def get_my_tokens(self) -> Dict[str, Any]:
        """
        查看我的Token
        
        Returns:
            包含tokens和quota的响应数据
        """
        return self._request('GET', '/api/tokens/my-tokens')
    
    def refresh_token_usage(self, account_id: str) -> Dict[str, Any]:
        """
        刷新Token额度
        
        Args:
            account_id: 账户ID
            
        Returns:
            包含account和is_available的响应数据
        """
        return self._request('POST', f'/api/tokens/refresh/{account_id}')
    
    # ==================== 辅助方法 ====================
    
    def is_logged_in(self) -> bool:
        """检查是否已登录"""
        return self.token is not None


# ==================== 使用示例 ====================

def example_usage():
    """使用示例"""
    
    # 创建客户端
    client = KiroAuthClient('http://localhost:2233')
    
    # 示例1: 用户注册流程
    print("=== 示例1: 用户注册 ===")
    try:
        # 1. 发送验证码
        client.send_verification_code('user@example.com')
        print("✅ 验证码已发送")
        
        # 2. 用户输入验证码后，进行注册
        code = input("请输入验证码: ")
        result = client.register('myusername', 'user@example.com', 'password123', code)
        print(f"✅ 注册成功: {result['user']['username']}")
        print(f"JWT Token: {result['token'][:50]}...")
        
        # 3. 申请Token
        token_request = client.request_token()
        print(f"✅ Token申请已提交: {token_request['allocation_id']}")
        
    except KiroAuthError as e:
        print(f"❌ 错误: {e}")
    
    # 示例2: 用户登录
    print("\n=== 示例2: 用户登录 ===")
    try:
        result = client.login('user@example.com', 'password123')
        print(f"✅ 登录成功: {result['user']['username']}")
    except KiroAuthError as e:
        print(f"❌ 错误: {e}")
    
    # 示例3: 查看我的Token
    print("\n=== 示例3: 查看我的Token ===")
    try:
        result = client.get_my_tokens()
        print(f"配额: {result['quota']['used']}/{result['quota']['max']}")
        
        for token in result['tokens']:
            account = token['account']
            print(f"\n账户: {account['email']}")
            print(f"订阅: {account['subscription_type']}")
            print(f"使用率: {account['usage_percent']}%")
            print(f"Access Token: {account['access_token']}")
    except KiroAuthError as e:
        print(f"❌ 错误: {e}")
    
    # 示例4: 刷新Token使用量
    print("\n=== 示例4: 刷新Token使用量 ===")
    try:
        result = client.get_my_tokens()
        
        if result['tokens']:
            account_id = result['tokens'][0]['account']['id']
            refresh_result = client.refresh_token_usage(account_id)
            
            print("✅ 刷新成功")
            print(f"使用率: {refresh_result['account']['usage_percent']}%")
            print(f"是否可用: {'是' if refresh_result['is_available'] else '否'}")
    except KiroAuthError as e:
        print(f"❌ 错误: {e}")
    
    # 示例5: 检查登录状态
    print("\n=== 示例5: 检查登录状态 ===")
    if client.is_logged_in():
        print("✅ 已登录")
    else:
        print("❌ 未登录")
    
    # 示例6: 退出登录
    print("\n=== 示例6: 退出登录 ===")
    client.logout()
    print("✅ 已退出登录")


if __name__ == '__main__':
    # 运行示例
    # example_usage()
    
    # 或者交互式使用
    print("Kiro Token 管理系统 - Python客户端")
    print("导入方式: from kiro_auth_client import KiroAuthClient")
    print("创建客户端: client = KiroAuthClient('http://localhost:2233')")
