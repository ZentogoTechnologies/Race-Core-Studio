from fastapi import APIRouter, HTTPException, Query

users = APIRouter()

@users.get("/users", tags=["Users"])
def get_users():
    return {"response": "users on route"}
