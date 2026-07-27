from fastapi import APIRouter, HTTPException, Query

users = APIRouter()

@users.get("/users", tags=["Users"])
def get_users():
    return {"response": "users on route"}

"""
@client.get("/client", tags=["Clients"])
def get_client(clientId: int = Query(..., description="ID del cliente")):
    try:
        if not clientId or clientId == 0:
            raise HTTPException(status_code=400, detail="clientId inválido")

        result = get_client_info(clientId)
        if isinstance(result, dict) and result.get("detail") == "Cliente no encontrado":
            raise HTTPException(status_code=400, detail="Cliente no encontrado")

        return result  # 200 OK por defecto

    except HTTPException as e:
        raise e

    except Exception as e:
        print(e)
        raise HTTPException(status_code=408, detail="Error inesperado")
"""