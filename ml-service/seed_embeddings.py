import os
import json
import psycopg2
from sentence_transformers import SentenceTransformer

db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres.tanynjdwquarhapldhuz:RhkXdZQNXi4Jero2@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres')

def build_document(g):
    doc = f"{g[1]}. Category: {g[2]}. Designer: {g[3] or 'unbranded'}. Size: {g[4]}. Condition: {g[5]}. Location: {g[7]}."
    if g[6]:
        doc += f" Description: {g[6]}"
    return doc

def run():
    print('Loading model...')
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print('Connecting to DB...')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT id, name, category, designer, size, condition, description, location FROM garments WHERE active = true")
    garments = cur.fetchall()
    
    print(f'Found {len(garments)} garments to embed.')
    
    for g in garments:
        g_id = g[0]
        doc = build_document(g)
        emb = model.encode(doc).tolist()
        
        cur.execute("INSERT INTO product_embeddings (product_id, model_name, embedding, searchable_text_hash) VALUES (%s, %s, %s, %s) ON CONFLICT (product_id, model_name) DO UPDATE SET embedding = EXCLUDED.embedding", (g_id, 'all-MiniLM-L6-v2', json.dumps(emb), str(hash(doc))))
        
    conn.commit()
    cur.close()
    conn.close()
    print('Embeddings seeded successfully.')

if __name__ == '__main__':
    run()


