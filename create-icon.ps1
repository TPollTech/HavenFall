Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('logo.png')
$bmp = New-Object System.Drawing.Bitmap($img, 256, 256)
$bmp.Save('src-tauri\icons\icon.ico', [System.Drawing.Imaging.ImageFormat]::Icon)
$bmp.Dispose()
$img.Dispose()
echo "ICO created"