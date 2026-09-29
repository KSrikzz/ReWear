from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sentence_transformers import SentenceTransformer
import numpy as np

app = FastAPI(title="ReWear ML Service")

# Load the model
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: List[float]

class ProductEmbedding(BaseModel):
    product_id: str
    embedding: List[float]

class SearchRequest(BaseModel):
    query: str
    product_embeddings: List[ProductEmbedding]
    top_k: Optional[int] = 10

class SearchResult(BaseModel):
    product_id: str
    score: float

class SearchResponse(BaseModel):
    results: List[SearchResult]

@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    embedding = model.encode(request.text).tolist()
    return EmbedResponse(embedding=embedding)

@app.post("/search", response_model=SearchResponse)
def search(request: SearchRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    
    if not request.product_embeddings:
        return SearchResponse(results=[])

    query_embedding = model.encode(request.query)
    
    results = []
    for pe in request.product_embeddings:
        pe_emb = np.array(pe.embedding)
        # Cosine similarity
        score = np.dot(query_embedding, pe_emb) / (np.linalg.norm(query_embedding) * np.linalg.norm(pe_emb))
        results.append(SearchResult(product_id=pe.product_id, score=float(score)))
    
    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)
    
    # Keep top_k
    top_k = request.top_k if request.top_k else 10
    results = results[:top_k]
    
    return SearchResponse(results=results)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
