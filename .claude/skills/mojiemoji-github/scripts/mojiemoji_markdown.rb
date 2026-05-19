#!/usr/bin/env ruby

require "optparse"
require "uri"

options = {
  base_url: "https://mojiemoji.jozo.beer",
  mode: :path,
  format: :markdown,
  background: "transparent",
}

OptionParser.new do |parser|
  parser.banner = "Usage: mojiemoji_markdown.rb --text TEXT [options]"

  parser.on("--text TEXT", "Render text as a mojiemoji image") { |v| options[:text] = v }
  parser.on("--alt TEXT", "Alt text; defaults to --text") { |v| options[:alt] = v }
  parser.on("--base-url URL", "Base URL for the mojiemoji service") { |v| options[:base_url] = v }
  parser.on("--path", "Use /emoji/{text} form (default)") { options[:mode] = :path }
  parser.on("--query", "Use /emoji?q={text} form") { options[:mode] = :query }
  parser.on("--html", "Output HTML img tag instead of markdown") { options[:format] = :html }
  parser.on("--inline", "Shortcut for inline stamps: --html --height 24 --align absmiddle") do
    options[:format] = :html
    options[:height] ||= "24"
    options[:align] ||= "absmiddle"
  end
  parser.on("--height VALUE", "img height attribute (html only)") { |v| options[:height] = v }
  parser.on("--width VALUE", "img width attribute (html only)") { |v| options[:width] = v }
  parser.on("--align VALUE", "img align attribute, e.g. absmiddle (html only)") { |v| options[:align] = v }
  parser.on("--font VALUE", "font parameter") { |v| options[:font] = v }
  parser.on("--color VALUE", "color parameter") { |v| options[:color] = v }
  parser.on("--animation VALUE", "animation parameter") { |v| options[:animation] = v }
  parser.on("--speed VALUE", "speed parameter") { |v| options[:speed] = v }
  parser.on("--gradient VALUE", "gradient parameter") { |v| options[:gradient] = v }
  parser.on("--flip VALUE", "flip parameter") { |v| options[:flip] = v }
  parser.on("--padding VALUE", "padding parameter") { |v| options[:padding] = v }
  parser.on("--background VALUE", "background parameter (default: transparent)") { |v| options[:background] = v }
  parser.on("--outline VALUE", "outline color (hex, or 'darker' / 'lighter')") { |v| options[:outline] = v }
  parser.on("--outline-width VALUE", "outline width 0..4 px (default 0 = no outline)") { |v| options[:outline_width] = v }
end.parse!

abort "error: --text is required" if options[:text].to_s.empty?

params = {
  "font" => options[:font],
  "color" => options[:color],
  "animation" => options[:animation],
  "speed" => options[:speed],
  "gradient" => options[:gradient],
  "flip" => options[:flip],
  "padding" => options[:padding],
  "background" => options[:background],
  "outline" => options[:outline],
  "outline_width" => options[:outline_width],
}.compact

base = options[:base_url].sub(%r{/\z}, "")
alt = options[:alt] || options[:text]
path =
  if options[:mode] == :query
    query = URI.encode_www_form({ "q" => options[:text] }.merge(params))
    "/emoji?#{query}"
  else
    suffix = params.empty? ? "" : "?#{URI.encode_www_form(params)}"
    "/emoji/#{URI::DEFAULT_PARSER.escape(options[:text])}#{suffix}"
  end

url = "#{base}#{path}"

def escape_attr(value)
  value.to_s.gsub("&", "&amp;").gsub('"', "&quot;").gsub("<", "&lt;").gsub(">", "&gt;")
end

# Markdown image alt has its own escaping rules. The CommonMark spec treats
# `]` as the alt terminator, `\` as an escape, and a literal newline breaks
# the image syntax altogether. Escape these in the alt before splicing.
def escape_md_alt(value)
  value.to_s
       .gsub("\\", "\\\\\\\\")  # \  →  \\
       .gsub("[", "\\[")
       .gsub("]", "\\]")
       .gsub(/\r?\n/, " ")
end

# Markdown link/image URL is delimited by parentheses. A literal ')' in the
# URL closes it. The mojiemoji service shouldn't return one, but be defensive
# in case of future schema changes.
def escape_md_url(value)
  value.to_s.gsub(")", "%29").gsub("(", "%28")
end

if options[:format] == :html
  attrs = { "src" => url, "alt" => alt }
  attrs["height"] = options[:height] if options[:height]
  attrs["width"] = options[:width] if options[:width]
  attrs["align"] = options[:align] if options[:align]
  rendered = attrs.map { |k, v| %(#{k}="#{escape_attr(v)}") }.join(" ")
  puts "<img #{rendered}>"
else
  puts "![#{escape_md_alt(alt)}](#{escape_md_url(url)})"
end
