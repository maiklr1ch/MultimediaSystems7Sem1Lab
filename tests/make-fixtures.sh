#!/usr/bin/env bash
# Генерує тестові медіафайли (потрібен ffmpeg з libx264, libvpx, libopus, libvorbis, libmp3lame).
# Готові файли вже лежать у tests/fixtures — скрипт потрібен лише щоб їх перестворити.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fixtures/hls
cd fixtures

DUR=10
VIDEO="-f lavfi -i testsrc2=size=320x180:rate=25:duration=$DUR"
# м'який мажорний акорд замість одного писку синусоїди
AUDIO="-f lavfi -i aevalsrc=0.15*sin(2*PI*261.63*t)+0.15*sin(2*PI*329.63*t)+0.15*sin(2*PI*392*t):s=22050:d=$DUR"
Q="-hide_banner -loglevel error -y"

ffmpeg $Q $VIDEO $AUDIO -c:v libx264 -pix_fmt yuv420p -crf 30 -g 50 -c:a aac -b:a 64k -shortest -movflags +faststart sample.mp4
ffmpeg $Q $VIDEO $AUDIO -c:v libvpx-vp9 -b:v 150k -deadline realtime -c:a libopus -b:a 48k -shortest sample.webm
ffmpeg $Q $VIDEO $AUDIO -c:v libx264 -pix_fmt yuv420p -crf 30 -g 50 -c:a aac -b:a 64k -shortest sample.mkv
ffmpeg $Q $VIDEO $AUDIO -c:v libx264 -pix_fmt yuv420p -crf 30 -g 50 -c:a aac -b:a 64k -shortest sample.mov
ffmpeg $Q $AUDIO -c:a libmp3lame -b:a 64k sample.mp3
ffmpeg $Q $AUDIO -c:a pcm_s16le sample.wav
ffmpeg $Q $AUDIO -c:a libvorbis -q:a 2 sample.ogg
ffmpeg $Q $AUDIO -c:a flac sample.flac
ffmpeg $Q $AUDIO -c:a aac -b:a 64k sample.m4a

# HLS (VOD) з того ж MP4: 5 сегментів по 2 с
ffmpeg $Q -i sample.mp4 -c copy -f hls -hls_time 2 -hls_playlist_type vod \
  -hls_segment_filename hls/segment%d.ts hls/index.m3u8

# "Битий" файл: розширення .mp4, але всередині текст — для перевірки обробки помилок
echo "not a video" > broken.mp4

ls -la . hls
