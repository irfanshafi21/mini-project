$ErrorActionPreference = 'Stop'

$ollamaCommand = Get-Command ollama -ErrorAction Stop
$env:OLLAMA_HOST = '127.0.0.1:11435'
$env:OLLAMA_VULKAN = '1'
$env:OLLAMA_IGPU_ENABLE = '1'

Write-Host 'Starting Ollama with Vulkan GPU support on http://127.0.0.1:11435'
Write-Host 'Keep this terminal open while generating papers.'
& $ollamaCommand.Source serve
