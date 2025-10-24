import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from app.core.config import settings


class StorageService:
    def __init__(self):
        # Internal client for API operations (uses Docker network hostname)
        self.client = boto3.client(
            's3',
            endpoint_url=f"{'https' if settings.MINIO_SECURE else 'http'}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
        # External client for presigned URLs (uses localhost for browser access)
        external_endpoint = settings.MINIO_ENDPOINT.replace('minio', 'localhost')
        self.external_client = boto3.client(
            's3',
            endpoint_url=f"{'https' if settings.MINIO_SECURE else 'http'}://{external_endpoint}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version='s3v4'),
            region_name='us-east-1'
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
            print(f"MinIO bucket '{self.bucket}' exists")
        except ClientError as e:
            print(f"Creating MinIO bucket '{self.bucket}'...")
            try:
                self.client.create_bucket(Bucket=self.bucket)
                print(f"MinIO bucket '{self.bucket}' created successfully")
            except Exception as create_error:
                print(f"Failed to create bucket: {create_error}")
                raise
    
    def generate_presigned_upload_url(self, object_key: str, content_type: str, expires_in: int = 3600) -> str:
        # Use external client so signature matches localhost hostname
        url = self.external_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket,
                'Key': object_key,
                'ContentType': content_type
            },
            ExpiresIn=expires_in
        )
        return url
    
    def generate_presigned_download_url(self, object_key: str, expires_in: int = 3600) -> str:
        # Use external client so signature matches localhost hostname
        url = self.external_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': self.bucket,
                'Key': object_key
            },
            ExpiresIn=expires_in
        )
        return url
    
    def download_file(self, object_key: str, local_path: str):
        self.client.download_file(self.bucket, object_key, local_path)
    
    def upload_file(self, local_path: str, object_key: str):
        self.client.upload_file(local_path, self.bucket, object_key)
    
    def delete_object(self, object_key: str):
        self.client.delete_object(Bucket=self.bucket, Key=object_key)
    
    def delete_prefix(self, prefix: str):
        """Delete all objects with the given prefix"""
        response = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
        if 'Contents' in response:
            objects = [{'Key': obj['Key']} for obj in response['Contents']]
            if objects:
                self.client.delete_objects(
                    Bucket=self.bucket,
                    Delete={'Objects': objects}
                )


storage_service = StorageService()

