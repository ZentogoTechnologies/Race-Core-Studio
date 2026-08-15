from fastapi import APIRouter, HTTPException, Query

events = APIRouter()

@events.get("/events", tags=["Events"])
def get_events():
    return {"response": "events on route"}

