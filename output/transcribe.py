import os, pathlib, json
import imageio_ffmpeg
bin_dir=pathlib.Path(__file__).resolve().parent/'bin'
bin_dir.mkdir(exist_ok=True)
link=bin_dir/'ffmpeg'
if not link.exists(): link.symlink_to(imageio_ffmpeg.get_ffmpeg_exe())
os.environ['PATH']=str(bin_dir)+os.pathsep+os.environ['PATH']
import mlx_whisper
source='/Users/puihockyang/Desktop/sep 22 6.00pm meeting'
result=mlx_whisper.transcribe(source, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', verbose=True, condition_on_previous_text=False)
out=pathlib.Path(__file__).resolve().parent
(out/'transcript.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
def stamp(t):
 t=int(t); return f'{t//3600:02}:{t%3600//60:02}:{t%60:02}'
lines=['# Original meeting transcript','','Source: sep 22 6.00pm meeting','', 'Automatically transcribed in the original language. No summary or translation. Speaker identities have not been verified; transcription may contain errors.','']
for s in result['segments']:
 lines += [f"[{stamp(s['start'])} – {stamp(s['end'])}] {s['text'].strip()}",'']
(out/'original.md').write_text('\n'.join(lines))
print('SAVED',out/'original.md',flush=True)
