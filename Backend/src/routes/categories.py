from fastapi import APIRouter, HTTPException, Query

categories = APIRouter()

@categories.get("/categories", tags=["Categories"])
def get_categories():
    return {"response": "categories on route"}

