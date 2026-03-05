export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

export function InlineSpinner() {
  return <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin inline-block" />;
}
