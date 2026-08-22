from fastapi import APIRouter, HTTPException, Query

graphics = APIRouter()

@graphics.get("/graphics", tags=["Graphics"])
def get_graphics():
    return {"response": "graphics on route"}
