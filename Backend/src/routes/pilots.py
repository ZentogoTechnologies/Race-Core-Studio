from fastapi import APIRouter, Depends, HTTPException, status, Form

pilots = APIRouter()

@pilots.get("/pilots", tags=["Pilots"])
def get_pilots():
    return {"response": "pilots on route"}