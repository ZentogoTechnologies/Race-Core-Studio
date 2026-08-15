from fastapi import APIRouter, HTTPException, Query

login = APIRouter()

@login.get("/login", tags=["Login"])
def get_login():
    return {"response": "login on route"}

