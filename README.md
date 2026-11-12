# Pixel Vault

เว็บคลัง Pixel FX แบบ static ใช้ Canvas แสดงพรีวิวและสร้าง PNG โปร่งใส มีเอฟเฟกต์ตัวอย่าง 8 แบบ และเพิ่ม sprite sheet ของตัวเองได้ เปิดดูได้ทันทีด้วย `index.html` โดยไม่ต้องติดตั้ง dependency หรือ build

## ทดลองในเครื่อง

ดับเบิลคลิก `index.html` เพื่อดูพรีวิวและทดลองส่งออก ถ้าจะเก็บคลังจริงจัง ให้เปิด PowerShell ในโฟลเดอร์นี้แล้วรันคำสั่งด้านล่าง จากนั้นเปิด `http://localhost:8000` เพื่อให้คลังใช้ที่อยู่เดิมทุกครั้ง

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

- ค้นหาตามชื่อหรือเลือกหมวดหมู่ แล้วเลือกเอฟเฟกต์เพื่อเล่น หยุด หรือเลื่อนดูทีละเฟรม
- เอฟเฟกต์ตัวอย่างเปลี่ยน Palette และ New seed ได้ ทั้งตัวอย่างและ PNG ที่นำเข้าใช้ Mirror, FPS และ Loop ได้
- กด **Add sprite sheet** เพื่อเพิ่ม PNG กริดสม่ำเสมอ เรียงเฟรมจากซ้ายไปขวาแล้วลงแถวถัดไป โดยไม่มีช่องว่างระหว่างเฟรม ใส่ขนาดเฟรมเป็นพิกเซลและจำนวนเฟรมที่ใช้จริง ขนาดเฟรมสูงสุด 512 × 512 และสูงสุด 120 เฟรม
- คลังที่เพิ่มเองเก็บใน IndexedDB ตามเบราว์เซอร์ โปรไฟล์ และที่อยู่เว็บ กด **Export library** เพื่อสำรองเป็น `library.json` ซึ่งรวมข้อมูล PNG และใช้ **Import library** เพื่อกู้คืนหรือย้ายเครื่อง

## ส่งเข้า Unity

1. ติดตั้งแพ็กเกจ **2D Sprite** (`com.unity.2d.sprite`) ใน Package Manager หากยังไม่มี ตัวนำเข้าใช้ Sprite Editor Data Provider ของ Unity 2022.3 ขึ้นไป
2. คัดลอก `unity/PixelVaultImporter.cs` เข้า `Assets/Editor/` ในโปรเจกต์ Unity ทำครั้งเดียว
3. เลือกเอฟเฟกต์ ปรับ FPS, Loop, PPU (Pixels Per Unit) และกด **Export Unity ZIP** แตก ZIP แล้วนำ PNG กับ `*.pixelvault.json` ไปไว้โฟลเดอร์เดียวกันภายใต้ `Assets/`
4. เลือกไฟล์ JSON ในหน้าต่าง Project แล้วใช้เมนู **Assets → Pixel Vault → Import Sprite Sheet and Animation** สคริปต์จะตั้ง Point filter, ตัดเฟรมด้วย pivot กึ่งกลาง และสร้างไฟล์ `.anim` สำหรับ SpriteRenderer ในโฟลเดอร์เดียวกัน
5. ใช้คลิปกับ Animator บน GameObject ที่มี SpriteRenderer หากต้องการใช้เฉพาะภาพ สามารถนำ PNG ไปตั้ง Sprite Mode เป็น Multiple และตัดด้วย Grid by Cell Size ตาม width/height ใน JSON ได้

## เผยแพร่ผ่าน GitHub Pages

1. สร้าง repository บน GitHub แล้ววางไฟล์ในโฟลเดอร์นี้ไว้ที่ root ของ repository ให้ `index.html` อยู่ระดับบนสุด
2. ใน **Settings → Pages → Build and deployment** เลือก **Deploy from a branch** จากนั้นเลือก **main** และ **/(root)** แล้วกด **Save**
3. เมื่อ GitHub แสดงลิงก์ในหน้า Pages ให้เปิดลิงก์นั้นเพื่อดูเว็บ
4. เมื่อต้องการให้คนอื่นเห็นคลังที่เพิ่มเอง กด **Export library** แล้วนำ `library.json` ที่ได้ไปแทนไฟล์ใน repository และ commit ขึ้น branch ที่เผยแพร่ เว็บจะโหลดคลังนี้เมื่อเปิดผ่าน HTTP(S) ให้ใส่เฉพาะ asset ที่ตั้งใจเผยแพร่

[เอกสาร GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

รูปแบบแกลเลอรีและพรีวิวอ้างอิงจาก [pixelfx](https://patch-gg.github.io/pixelfx/) โดยเอฟเฟกต์ตัวอย่างในโปรเจกต์นี้สร้างด้วยโค้ดของ Pixel Vault
