"""Read-only Git object scan. Reports locations and categories, never values."""
import json
import re
import subprocess

objects = subprocess.check_output(
    ["git", "rev-list", "--objects", "--all"], text=True, encoding="utf-8"
).splitlines()
paths = {}
for entry in objects:
    oid, _, path = entry.partition(" ")
    paths.setdefault(oid, path)
metadata = subprocess.run(
    ["git", "cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    input="\n".join(paths) + "\n", text=True, capture_output=True, check=True
).stdout.splitlines()
patterns = {
    "provider-token": re.compile(r"(?:sk_(?:live|test)_[A-Za-z0-9]{12,}|GOCSPX-[\w-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|re_[A-Za-z0-9_]{20,}|whsec_[A-Za-z0-9]{16,})"),
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "credential-url": re.compile(r"[a-z]+://[^/\s:@]+:([^@\s/]+)@"),
    "credential-assignment": re.compile(r"""(?ix)
        (?:password|passwd|secret|api[_ .-]?key|access[_ .-]?token|auth[_ .-]?token)
        [\w .-]* ["']? \s* [:=] \s* ["']? ([^\s"'<>;,}]+)
    """),
}
safe = re.compile(r"(?i)(REDACTED|placeholder|example|your[_-]|changeme|process\.env|System\.getenv|\$\{|undefined|null|false|true|^\*+$)")
batch = subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
findings = []
scanned = skipped = 0
for row in metadata:
    oid, kind, size = row.split()
    if kind != "blob":
        continue
    batch.stdin.write((oid + "\n").encode())
    batch.stdin.flush()
    header = batch.stdout.readline().split()
    data = batch.stdout.read(int(header[2]))
    batch.stdout.read(1)
    if b"\0" in data:
        continue
    scanned += 1
    for number, line in enumerate(data.decode("utf-8", errors="replace").splitlines(), 1):
        for category, pattern in patterns.items():
            for match in pattern.finditer(line):
                value = match.group(1) if match.lastindex else match.group()
                if safe.search(value):
                    continue
                context = re.sub(r"""(["'])(?:(?!\1).)*?\1""", '"[literal omitted]"', line.strip())
                if "env(" in line:
                    context += " [environment lookup]"
                findings.append({"blob": oid, "path": paths[oid], "line": number, "category": category, "context": context})
batch.stdin.close()
batch.wait()
print(json.dumps({"text_blobs_scanned": scanned, "oversize_blobs_skipped": skipped, "findings": findings}, indent=2))
