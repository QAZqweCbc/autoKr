#!/usr/bin/env python3
"""
批量提取 Vue 组件的 <style scoped> 到独立 CSS 文件
"""

import os
import re
from pathlib import Path

# 配置
VIEWS_DIR = Path('src/views')
STYLES_DIR = Path('src/styles')

def extract_style_from_vue(vue_file_path):
    """从 Vue 文件中提取 <style scoped> 内容"""
    with open(vue_file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配 <style scoped> ... </style>
    pattern = r'<style scoped>(.*?)</style>'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        return None, content
    
    style_content = match.group(1).strip()
    
    # 移除 <style scoped> 块
    new_content = re.sub(pattern, '', content, flags=re.DOTALL)
    
    return style_content, new_content

def kebab_case(name):
    """将 PascalCase 转换为 kebab-case"""
    # AccountsView -> accounts-view
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()

def add_css_import(vue_content, css_filename):
    """在 Vue 文件的 <script setup> 中添加 CSS import"""
    # 查找 <script setup> 标签后的第一个 import 语句
    pattern = r'(<script setup[^>]*>)'
    
    import_statement = f"import '../styles/{css_filename}'"
    
    def replacer(match):
        return f"{match.group(1)}\n{import_statement}"
    
    # 如果已经有这个 import，不重复添加
    if import_statement in vue_content:
        return vue_content
    
    new_content = re.sub(pattern, replacer, vue_content, count=1)
    return new_content

def process_vue_file(vue_file_path):
    """处理单个 Vue 文件"""
    file_name = vue_file_path.stem  # 例如: AccountsView
    css_file_name = kebab_case(file_name) + '.css'  # 例如: accounts-view.css
    css_file_path = STYLES_DIR / css_file_name
    
    print(f'处理: {vue_file_path.name}')
    
    # 提取样式
    style_content, vue_content = extract_style_from_vue(vue_file_path)
    
    if not style_content:
        print(f'  ⚠️  没有找到 <style scoped> 块')
        return False
    
    # 创建 CSS 文件
    STYLES_DIR.mkdir(exist_ok=True)
    with open(css_file_path, 'w', encoding='utf-8') as f:
        f.write(style_content)
    print(f'  ✅ 创建: {css_file_name}')
    
    # 添加 import 并保存 Vue 文件
    vue_content = add_css_import(vue_content, css_file_name)
    with open(vue_file_path, 'w', encoding='utf-8') as f:
        f.write(vue_content)
    print(f'  ✅ 更新: {vue_file_path.name}')
    
    return True

def main():
    """主函数"""
    print('开始批量提取 Vue 组件样式...\n')
    
    # 获取所有 Vue 文件
    vue_files = list(VIEWS_DIR.glob('*.vue'))
    
    if not vue_files:
        print(f'❌ 在 {VIEWS_DIR} 中没有找到 Vue 文件')
        return
    
    print(f'找到 {len(vue_files)} 个 Vue 文件\n')
    
    success_count = 0
    for vue_file in vue_files:
        if process_vue_file(vue_file):
            success_count += 1
        print()
    
    print(f'完成！成功处理 {success_count}/{len(vue_files)} 个文件')
    print(f'\n样式文件保存在: {STYLES_DIR}')
    print('\n请运行 npm run build 重新编译前端')

if __name__ == '__main__':
    main()
