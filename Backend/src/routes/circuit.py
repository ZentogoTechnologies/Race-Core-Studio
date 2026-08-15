from fastapi import APIRouter, HTTPException, Query

circuit = APIRouter()

@circuit.get("/circuit", tags=["Categories"])
def get_circuit():
    return {"response": "circuit on route"}

