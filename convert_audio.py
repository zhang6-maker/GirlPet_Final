import wave
import numpy as np

def resample_audio(input_path, output_path, target_rate=16000):
    # 1. 读取原始音频
    with wave.open(input_path, 'rb') as wf:
        params = wf.getparams()
        orig_rate = params.framerate
        nchannels = params.nchannels
        sampwidth = params.sampwidth
        nframes = params.nframes
        raw_data = wf.readframes(nframes)

    # 2. 转为 numpy 数组（假设 16-bit PCM）
    audio = np.frombuffer(raw_data, dtype=np.int16)

    # 3. 立体声 -> 单声道
    if nchannels == 2:
        audio = audio.reshape(-1, 2).mean(axis=1).astype(np.int16)

    # 4. 重采样（线性插值）
    if orig_rate != target_rate:
        duration = len(audio) / orig_rate
        new_len = int(duration * target_rate)
        old_idx = np.linspace(0, len(audio) - 1, len(audio))
        new_idx = np.linspace(0, len(audio) - 1, new_len)
        audio = np.interp(new_idx, old_idx, audio).astype(np.int16)

    # 5. 写入新文件
    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(sampwidth)
        wf.setframerate(target_rate)
        wf.writeframes(audio.tobytes())

if __name__ == '__main__':
    resample_audio('test.wav', 'test_16k.wav')
    print('✅ 转换完成: test_16k.wav')