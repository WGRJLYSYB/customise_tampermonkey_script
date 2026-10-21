import argparse
import os
import numpy as np


def main():
  parser = argparse.ArgumentParser(
      description='使用 Python 全局密集搜索强行计算 M3U8 的真实 FPS'
  )
  parser.add_argument('file_path', type=str, help='M3U8 文件的路径')
  args = parser.parse_args()

  if not os.path.exists(args.file_path):
    print(f'❌ 找不到文件: {args.file_path}')
    return

  # 1. 提取所有切片时长
  durations = []
  with open(args.file_path, 'r', encoding='utf-8') as f:
    for line in f:
      line = line.strip()
      if line.startswith('#EXTINF:'):
        duration_str = line.replace('#EXTINF:', '').split(',')[0].strip()
        try:
          durations.append(float(duration_str))
        except ValueError:
          continue

  if not durations:
    print('⚠️ 未能在文件中检测到任何有效的时间切片（#EXTINF）。')
    return

  d_arr = np.array(durations)
  total_segments = len(d_arr)
  print(
      f'成功从 {args.file_path} 提取到 {total_segments}'
      ' 个切片时长，正在进行全区间密集扫描...\n'
  )

  # 2. 生成从 10.0 到 60.0 的密集 FPS 候选池（步长 0.001）
  # 如果不确定范围，也可以扩展到 120
  fps_grid = np.arange(10.0, 60.0, 0.001)

  best_fps = 0
  max_matches = -1
  tolerance = 0.01  # 更严格的整数对齐容差

  # 用于记录表现最好的前几个候选
  top_results = []

  for fps in fps_grid:
    calculated_frames = d_arr * fps
    # 计算有多少个切片乘以此 FPS 后非常接近整数
    matches = np.sum(np.abs(calculated_frames - np.round(calculated_frames)) < tolerance)
    
    if matches > max_matches:
      max_matches = matches
      best_fps = fps

    # 收集匹配度较高的结果
    if matches >= total_segments * 0.5:  # 筛选出符合过半比例的
      top_results.append((fps, matches))

  print('=' * 40)
  print(f'🎯 强行计算出的最优 FPS 为: {best_fps:.3f}')
  print(f'📊 吻合度: {max_matches} / {total_segments} ({max_matches / total_segments * 100:.1f}%)')
  print('=' * 40)

  # 如果有其他高吻合度的候选（防止陷入局部多解），打印出来供参考
  if len(top_results) > 1:
    print('\n其他潜在的高吻合度 FPS 候选：')
    # 简单的去重排序
    top_results.sort(key=lambda x: x[1], reverse=True)
    seen = set()
    for fps, m in top_results[:5]:
      rounded_fps = round(fps, 2)
      if rounded_fps not in seen:
        seen.add(rounded_fps)
        print(f'  - FPS ≈ {fps:.3f} (吻合度: {m}/{total_segments})')

if __name__ == '__main__':
  main()