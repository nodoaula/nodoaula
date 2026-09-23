package io.github.nodoaula.catalog;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "resources")
class Resource {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	private String title;

	private String description;

	private LocalDate publishedAt;

	private Integer durationSeconds;

	private String channel;

	private String url;

	@Enumerated(EnumType.STRING)
	private ResourceType resourceType;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "course_id")
	private Course course;

	// Identificador y no relación: el usuario pertenece a otro módulo. Su
	// nombre se le pide al servicio de ese módulo cuando haga falta.
	private Long authorId;

	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(
			name = "resource_topics",
			joinColumns = @JoinColumn(name = "resource_id"),
			inverseJoinColumns = @JoinColumn(name = "topic_id"))
	private Set<Topic> topics = new LinkedHashSet<>();

	protected Resource() {
	}

	// Para crear un recurso nuevo al registrarlo manualmente (historia
	// HU105). Los temas se añaden después con addTopic, porque son una
	// colección de tamaño variable.
	Resource(String title, String description, LocalDate publishedAt, Integer durationSeconds,
			String channel, String url, ResourceType resourceType, Course course, Long authorId) {
		this.title = title;
		this.description = description;
		this.publishedAt = publishedAt;
		this.durationSeconds = durationSeconds;
		this.channel = channel;
		this.url = url;
		this.resourceType = resourceType;
		this.course = course;
		this.authorId = authorId;
	}

	void addTopic(Topic topic) {
		topics.add(topic);
	}

	Long getId() {
		return id;
	}

	String getTitle() {
		return title;
	}

	String getDescription() {
		return description;
	}

	LocalDate getPublishedAt() {
		return publishedAt;
	}

	Integer getDurationSeconds() {
		return durationSeconds;
	}

	String getChannel() {
		return channel;
	}

	String getUrl() {
		return url;
	}

	ResourceType getResourceType() {
		return resourceType;
	}

	Course getCourse() {
		return course;
	}

	Long getAuthorId() {
		return authorId;
	}

	Set<Topic> getTopics() {
		return topics;
	}

}
