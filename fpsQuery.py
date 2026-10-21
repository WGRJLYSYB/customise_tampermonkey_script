import argparse
import os


def main():
  # 1. 设置命令行参数解析
  parser = argparse.ArgumentParser(
      description='通过 M3U8 切片时长暴力破解视频的 FPS'
  )
  parser.add_argument(
      'file_path', type=str, help='M3U8 文件的路径（支持绝对路径或相对路径）'
  )
  args = parser.parse_args()

  m3u8_filename = args.file_path

  # 2. 检查文件是否存在
  if not os.path.exists(m3u8_filename):
    print(f'❌ 找不到文件: {m3u8_filename}，请检查路径是否正确。')
    return

  # 3. 读取文件内容并提取时长
  durations = []
  with open(m3u8_filename, 'r', encoding='utf-8') as f:
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

  # 4. 定义需要碰瓷的常见 FPS 候选池
  candidate_fps = [
      22.999,
      23.976,
      24.0,
      25.0,
      29.97,
      30.0,
      50.0,
      59.94,
      60.0,
  ]

  # 5. 开始碰撞测试
  best_fps = None
  max_matches = -1
  tolerance = 0.05  # 允许距离整数的误差范围

  print(
      f'成功从 {m3u8_filename} 提取到 {len(durations)} 个切片时长，开始进行 FPS'
      ' 匹配...\n'
  )

  for fps in candidate_fps:
    match_count = 0
    for d in durations:
      calculated_frames = d * fps
      if abs(calculated_frames - round(calculated_frames)) < tolerance:
        match_count += 1

    print(
        f'尝试 FPS = {fps: <12} -> 符合整数帧规律的切片数:'
        f' {match_count}/{len(durations)}'
    )

    if match_count > max_matches:
      max_matches = match_count
      best_fps = fps

  print('\n' + '=' * 40)
  print(
      f'🎯 最终推测该视频的最优 FPS 为: {best_fps}'
      f' (吻合度: {max_matches}/{len(durations)})'
  )
  print('=' * 40)


if __name__ == '__main__':
  main()