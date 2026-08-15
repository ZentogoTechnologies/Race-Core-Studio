from fastapi import APIRouter, HTTPException, Query

vehicles = APIRouter()

@vehicles.get("/vehicles", tags=["Vehicles"])
def get_vehicles():
    return {"response": "vehicles on route"}
