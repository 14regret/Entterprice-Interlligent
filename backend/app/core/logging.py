from __future__ import annotations

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        )
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Chroma's telemetry client is noisy and may try to reach the network.
    for noisy in ("chromadb", "chromadb.telemetry", "httpx", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
