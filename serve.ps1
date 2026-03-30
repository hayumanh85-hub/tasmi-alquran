param(
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

function Get-ContentType([string]$Path) {
  switch -Regex ($Path.ToLowerInvariant()) {
    "\.html$" { "text/html; charset=utf-8" }
    "\.css$"  { "text/css; charset=utf-8" }
    "\.js$"   { "application/javascript; charset=utf-8" }
    "\.json$" { "application/json; charset=utf-8" }
    "\.png$"  { "image/png" }
    "\.jpg$"  { "image/jpeg" }
    "\.jpeg$" { "image/jpeg" }
    "\.gif$"  { "image/gif" }
    "\.svg$"  { "image/svg+xml" }
    "\.ico$"  { "image/x-icon" }
    "\.woff$" { "font/woff" }
    "\.woff2$" { "font/woff2" }
    "\.ttf$"  { "font/ttf" }
    default   { "application/octet-stream" }
  }
}

$root = (Get-Location).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "Serving '$root' at http://localhost:$Port/ (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    try {
      $rawPath = $request.Url.AbsolutePath
      $path = [System.Uri]::UnescapeDataString($rawPath.TrimStart("/"))
      if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }

      $full = Join-Path $root $path
      if (Test-Path $full -PathType Container) {
        $full = Join-Path $full "index.html"
      }

      if (-not (Test-Path $full -PathType Leaf)) {
        $response.StatusCode = 404
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.ContentType = "text/plain; charset=utf-8"
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        continue
      }

      $response.StatusCode = 200
      $response.ContentType = Get-ContentType $full
      $fileBytes = [System.IO.File]::ReadAllBytes($full)
      $response.ContentLength64 = $fileBytes.Length
      $response.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
    } catch {
      $response.StatusCode = 500
      $response.ContentType = "text/plain; charset=utf-8"
      $msg = "500 Internal Server Error`n`n$($_.Exception.Message)"
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } finally {
      $response.OutputStream.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
