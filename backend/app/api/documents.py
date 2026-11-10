from __future__ import annotations

import logging

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status

from app.api.deps import ServicesDep
from app.schemas import DocumentMeta
from app.services.ingest import DocumentBusy, DocumentNotFound

logger = logging.getLogger(__name__)

router = APIRouter(tags=["documents"])


@router.post(
    "/upload",
    response_model=DocumentMeta,
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_document(
    services: ServicesDep,
    file: UploadFile = File(...),
) -> DocumentMeta:
    settings = services.settings
    filename = (file.filename or "").strip()

    if not filename:
        raise HTTPException(status_code=400, detail="缺少文件名")
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="只支持 PDF 文件")

    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)

    if not data:
        raise HTTPException(status_code=400, detail="文件为空")
    if len(data) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"文件超过 {settings.max_upload_mb}MB 上限",
        )
    if b"%PDF" not in data[:1024]:
        raise HTTPException(status_code=400, detail="文件不是有效的 PDF")

    logger.info("upload: %s (%s bytes)", filename, len(data))
    return await services.ingest.create(filename, data)


@router.get("/documents", response_model=list[DocumentMeta])
async def list_documents(services: ServicesDep) -> list[DocumentMeta]:
    return services.registry.all()


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(doc_id: str, services: ServicesDep) -> Response:
    try:
        await services.ingest.delete(doc_id)
    except DocumentNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DocumentBusy as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return Response(status_code=status.HTTP_204_NO_CONTENT)
