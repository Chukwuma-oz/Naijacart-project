// Frontend configuration.
// LOCAL:  point at your local API.
// AWS:    after deploying, change API_BASE to your ALB DNS name or the
//         custom domain in front of it, e.g. "http://naijacart-alb-123.af-south-1.elb.amazonaws.com"
//         then re-upload this file to the S3 frontend bucket and invalidate CloudFront.
window.NAIJACART_CONFIG = {
  API_BASE: 'http://localhost:8080',
};
