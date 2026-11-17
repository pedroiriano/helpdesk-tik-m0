param([string]$Only = '')
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wordApp = $null
try {
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.Visible = $false
    $wordApp.DisplayAlerts = 0
    $wordApp.AutomationSecurity = 3
    $files = Get-ChildItem -LiteralPath $packageRoot -Filter 'Blueprint_dan_Aturan_Helpdesk_TIK_Depok_M0.docx'
    if ($Only) { $files = $files | Where-Object { $_.BaseName -eq $Only } }
    foreach ($file in $files) {
        $renderDir = Join-Path (Join-Path $packageRoot 'qa') $file.BaseName
        New-Item -ItemType Directory -Force -Path $renderDir | Out-Null
        $openedDoc = $null
        try {
            $openedDoc = $wordApp.Documents.Open($file.FullName, $false, $true, $false)
            $openedDoc.Repaginate()
            $pdfTarget = Join-Path $renderDir ($file.BaseName + '.pdf')
            $openedDoc.ExportAsFixedFormat($pdfTarget, 17)
            $pageCount = $openedDoc.ComputeStatistics(2)
            Write-Output "PASS $($file.BaseName) pages=$pageCount"
        } finally {
            if ($openedDoc) { $openedDoc.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($openedDoc) }
        }
    }
} finally {
    if ($wordApp) { $wordApp.Quit(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($wordApp) }
}
