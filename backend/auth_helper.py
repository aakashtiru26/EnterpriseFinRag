import os
import time
import requests
import jwt
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Cache Google public certificates for signature verification
GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
certs_cache = {
    "keys": {},
    "expires_at": 0
}

def fetch_google_public_keys():
    """Fetches Google's public certificates, caching them dynamically."""
    current_time = time.time()
    if certs_cache["expires_at"] > current_time and certs_cache["keys"]:
        return certs_cache["keys"]
        
    try:
        response = requests.get(GOOGLE_CERTS_URL, timeout=5)
        if response.status_code == 200:
            certs = response.json()
            # Cache keys
            certs_cache["keys"] = certs
            
            # Read cache-control max-age header for expiration
            cache_control = response.headers.get("cache-control", "")
            max_age = 3600 # Default cache 1 hour
            for part in cache_control.split(","):
                if "max-age" in part:
                    try:
                        max_age = int(part.split("=")[1])
                    except Exception:
                        pass
            certs_cache["expires_at"] = current_time + max_age
            return certs
    except Exception as e:
        print(f"Error loading public keys from Google: {e}")
        
    # Return previously cached keys as fallback if server is offline
    return certs_cache["keys"]

def verify_firebase_token(token: str) -> dict:
    """Verifies Firebase JWT token offline and returns decoded payload."""
    try:
        # 1. Decode token header to find Key ID (kid)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(status_code=401, detail="Firebase token header missing Key ID (kid)")
            
        # 2. Get public key certificates
        public_keys = fetch_google_public_keys()
        cert_str = public_keys.get(kid)
        if not cert_str:
            raise HTTPException(status_code=401, detail="Firebase token signed with unknown Key ID")
            
        # 3. Read Firebase Project ID for issuer/audience checks
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        
        # 4. Set validation claims
        verify_options = {
            "verify_signature": True,
            "verify_exp": True,
        }
        
        # Verify and decode
        # Note: Firebase tokens are signed using RS256 algorithm
        # We load the certificate string and extract the public key object.
        from cryptography.x509 import load_pem_x509_certificate
        cert_obj = load_pem_x509_certificate(cert_str.encode())
        public_key = cert_obj.public_key()
        
        if project_id:
            iss = f"https://securetoken.google.com/{project_id}"
            aud = project_id
            payload = jwt.decode(
                token, 
                public_key, 
                algorithms=["RS256"], 
                audience=aud, 
                issuer=iss,
                options=verify_options
            )
        else:
            # Fallback if no project ID is configured yet (skip iss/aud checks)
            verify_options["verify_iss"] = False
            verify_options["verify_aud"] = False
            payload = jwt.decode(
                token, 
                public_key, 
                algorithms=["RS256"], 
                options=verify_options
            )
            
        return {
            "uid": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name")
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Firebase ID Token has expired")
    except jwt.InvalidSignatureError:
        raise HTTPException(status_code=401, detail="Firebase ID Token signature verification failed")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Authorization Token: {str(e)}")

# Security bearer scheme
security_bearer = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """FastAPI security dependency injecting authenticated user payload."""
    if not credentials:
        raise HTTPException(
            status_code=401, 
            detail="Authorization credentials (JWT bearer token) are missing"
        )
        
    token = credentials.credentials
    user_payload = verify_firebase_token(token)
    
    if not user_payload.get("uid"):
        raise HTTPException(status_code=401, detail="Invalid user ID claims in token")
        
    return user_payload
