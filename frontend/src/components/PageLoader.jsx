export default function PageLoader({ label = 'Duke u ngarkuar…' }) {
  return (
    <p className="page-loader" role="status">
      {label}
    </p>
  )
}
