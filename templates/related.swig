<style>
.img { overflow: auto; border: 2px solid #EEE; border-radius: 10px; padding: 10px; margin: 10px; }
img { width: 220px; height: 220px; }
</style>
{% for id, cluster in images %}
{% if cluster.matches.length > 0 %}
<div class="img">
    <div class="imgs">
        {% for match in cluster.matches %}
            <a href="{{match.url}}"><img src="{{match.thumb}}"/></a>
        {% endfor %}
    </div>
    <div class="details">
        <p>Pages: {% for page in cluster.pages %}
            <a href="test/pdf-pages/page-{{page - 1}}.jpg">{{page}}</a>
        {% endfor %}</p>
        <p>Sections:</p>
        <ul>
            {% for section in cluster.sections %}
                <li>{{section.heading}}</li>
            {% endfor %}
        </ul>
    </div>
</div>
{% endif %}
{% endfor %}