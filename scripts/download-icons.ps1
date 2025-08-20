$out = Join-Path $PSScriptRoot '..\fetched-icons' ; New-Item -ItemType Directory -Force -Path $out | Out-Null
for ($i = 1; $i -le 100; $i++) {
    $url = "https://armory.returnofreckoning.com/icon/$i"
    $dest = Join-Path $out "icon_$i.png"
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $dest -ErrorAction Stop } catch { Write-Host ("Failed {0}: {1}" -f $i, $_.Exception.Message) }
}
Write-Host "Done"
