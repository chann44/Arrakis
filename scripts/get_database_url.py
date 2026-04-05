#!/usr/bin/env python3

from pathlib import Path


def main() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return

    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() != "DATABASE_URL":
            continue
        cleaned = value.strip().strip('"').strip("'")
        print(cleaned, end="")
        return


if __name__ == "__main__":
    main()
