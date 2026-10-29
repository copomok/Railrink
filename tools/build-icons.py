from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
for size,name in [(192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-touch-icon.png'),(512,'icon-maskable.png')]:
 scale=size*3/192
 image=Image.new('RGB',(size*3,size*3),'#1168ad');draw=ImageDraw.Draw(image)
 for points in [[(30,130),(85,65),(154,65),(134,87),(96,87),(59,130)],[(80,130),(108,98),(141,98),(123,118),(115,118),(105,130)]]:
  draw.polygon([(round(x*scale),round(y*scale)) for x,y in points],fill='white')
 image.resize((size,size),Image.Resampling.LANCZOS).save(root/'assets'/name)
