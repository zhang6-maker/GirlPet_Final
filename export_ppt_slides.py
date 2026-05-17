import sys
import os
import win32com.client
from PIL import Image
from collections import Counter

def extract_dominant_colors(image_path, num_colors=2):
    """分析图片中出现最多的几种颜色，返回形式如 #1A1A2E(45.2%)"""
    img = Image.open(image_path)
    img = img.resize((200, 150))   # 缩小加速
    pixels = list(img.getdata())
    counter = Counter(pixels)
    most_common = counter.most_common(num_colors)

    results = []
    for color, count in most_common:
        hex_color = '#{:02X}{:02X}{:02X}'.format(color[0], color[1], color[2])
        percent = round(count / len(pixels) * 100, 1)
        results.append(f'{hex_color}({percent}%)')
    return results

def analyze_ppt(filepath):
    powerpoint = win32com.client.Dispatch("PowerPoint.Application")
    powerpoint.Visible = False          # 不显示 PowerPoint 窗口
    presentation = powerpoint.Presentations.Open(filepath, WithWindow=False)

    slide_count = presentation.Slides.Count
    temp_dir = os.path.join(os.path.dirname(filepath), '_ppt_temp_analysis')
    os.makedirs(temp_dir, exist_ok=True)

    all_texts = []
    all_colors = []

    for i in range(1, slide_count + 1):
        slide = presentation.Slides(i)

        # 导出为图片
        img_path = os.path.join(temp_dir, f'slide_{i}.png')
        slide.Export(img_path, 'PNG')

        # 分析主色调
        dominant = extract_dominant_colors(img_path, 2)
        all_colors.append(f'第{i}页主色调: {", ".join(dominant)}')

        # 提取文字
        for shape in slide.Shapes:
            if shape.HasTextFrame:
                txt = shape.TextFrame.TextRange.Text.strip()
                if txt:
                    all_texts.append(txt)

    presentation.Close()
    # powerpoint.Quit()  # 如果不想保留 PowerPoint 后台进程可以取消注释

    # 清理临时图片
    for f in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, f))
    os.rmdir(temp_dir)

    result = [f'幻灯片总数: {slide_count}']
    result.append('=== 各页主色调 ===')
    result.extend(all_colors)
    result.append('=== 文字内容摘要（前500字）===')
    result.append(' '.join(all_texts)[:500])
    return '\n'.join(result)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('用法: python export_ppt_slides.py <ppt文件路径>')
        sys.exit(1)
    filepath = sys.argv[1]
    print(analyze_ppt(filepath))